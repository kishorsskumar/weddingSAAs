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
import { Plus, Pencil, Trash2, Users, Check, ChevronsUpDown, Send, UserCheck, UserX, HelpCircle, UtensilsCrossed, Hotel, Car, MessageSquare, Search, RefreshCw, Calendar, Phone, Mail, AlertCircle, CreditCard, Crown, Clock, ArrowUpRight, X, LogOut, Heart } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { format, parseISO } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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

const TEAL = "#2FA4BC";
const TEAL_HOVER = "#268fa5";
const TEAL_LIGHT = "rgba(47,164,188,0.1)";
const TEXT_DARK = "#1a2332";
const TEXT_MUTED = "#64748b";

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

  const canSendMessages = user?.role === 'superadmin' || user?.role === 'wedding_planner' || user?.role === 'admin' || user?.role === 'tenant_admin';

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
      const res = await fetch(`/api/rsvp-message-templates/${id}`, { method: 'DELETE' });
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
      toast({ title: "Messages sent", description: `Sent: ${result.sent}, Failed: ${result.failed}` });
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

  const selectAllFiltered = () => setSelectedGuestIds(filteredGuests.map(g => g.id));
  const clearSelection = () => setSelectedGuestIds([]);

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
        <CardContent className="py-12 text-center text-slate-500">
          <Send className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select an event to manage outreach messages</p>
        </CardContent>
      </Card>
    );
  }

  if (!canSendMessages) {
    return (
      <Card className="bg-white">
        <CardContent className="py-12 text-center text-slate-500">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-amber-500" />
          <p>Only Admins and Wedding Planners can send RSVP messages</p>
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
              <CardTitle className="text-sm font-medium text-slate-500">Total Sent</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold" style={{ color: TEXT_DARK }}>{outreachStats.totalSent}</span>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Delivered</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-green-600">{outreachStats.delivered}</span>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Read</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-blue-600">{outreachStats.read}</span>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Failed</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-red-600">{outreachStats.failed}</span>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Pending</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-yellow-600">{outreachStats.pending}</span>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Greetings</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold" style={{ color: TEAL }}>{outreachStats.greetingsSent}</span>
            </CardContent>
          </Card>
          <Card className="bg-white">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500">Reminders</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-slate-600">{outreachStats.remindersSent}</span>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex gap-2 border-b pb-2">
        <Button
          variant={outreachSubTab === "send" ? "default" : "ghost"}
          onClick={() => setOutreachSubTab("send")}
          style={outreachSubTab === "send" ? { backgroundColor: TEAL } : {}}
        >
          <Send className="h-4 w-4 mr-2" />
          Send Messages
        </Button>
        <Button
          variant={outreachSubTab === "templates" ? "default" : "ghost"}
          onClick={() => setOutreachSubTab("templates")}
          style={outreachSubTab === "templates" ? { backgroundColor: TEAL } : {}}
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Templates
        </Button>
        <Button
          variant={outreachSubTab === "history" ? "default" : "ghost"}
          onClick={() => setOutreachSubTab("history")}
          style={outreachSubTab === "history" ? { backgroundColor: TEAL } : {}}
        >
          <Calendar className="h-4 w-4 mr-2" />
          Message History
        </Button>
      </div>

      {outreachSubTab === "send" && (
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-lg" style={{ color: TEXT_DARK }}>Send WhatsApp Messages</CardTitle>
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
                  <Button variant="outline" size="sm" onClick={clearSelection}>Clear</Button>
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                {(["all", "pending", "yes", "maybe", "no"] as const).map(status => {
                  const labels: Record<string, string> = { all: "All", pending: "Pending", yes: "Confirmed", maybe: "Maybe", no: "Declined" };
                  const colors: Record<string, string> = { all: TEAL, pending: "#ca8a04", yes: "#16a34a", maybe: "#f59e0b", no: "#dc2626" };
                  return (
                    <Button
                      key={status}
                      variant={guestStatusFilter === status ? "default" : "outline"}
                      size="sm"
                      onClick={() => setGuestStatusFilter(status)}
                      style={guestStatusFilter === status ? { backgroundColor: colors[status] } : {}}
                    >
                      {labels[status]} ({statusCounts[status]})
                    </Button>
                  );
                })}
              </div>

              <div className="max-h-60 overflow-y-auto border rounded-md p-2 space-y-1">
                {filteredGuests.length === 0 ? (
                  <div className="text-center py-4 text-slate-500">No guests with this status</div>
                ) : (
                  filteredGuests.map(guest => {
                    const status = getGuestStatus(guest.id);
                    return (
                      <div
                        key={guest.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer",
                          selectedGuestIds.includes(guest.id) && "bg-[#2FA4BC]/10"
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
                          <span className="text-sm text-slate-500 ml-2">{guest.phone}</span>
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
              className="w-full"
              style={{ backgroundColor: TEAL }}
              onClick={handleSendMessages}
              disabled={isSending || !selectedTemplateId || selectedGuestIds.length === 0}
              data-testid="send-messages-btn"
            >
              {isSending ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Sending...</>
              ) : (
                <><Send className="h-4 w-4 mr-2" />Send to {selectedGuestIds.length} Guest{selectedGuestIds.length !== 1 ? 's' : ''}</>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {outreachSubTab === "templates" && (
        <Card className="bg-white">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg" style={{ color: TEXT_DARK }}>Message Templates</CardTitle>
            <Button
              onClick={() => { setEditingTemplate(null); setIsTemplateDialogOpen(true); }}
              style={{ backgroundColor: TEAL }}
              data-testid="add-template-btn"
            >
              <Plus className="h-4 w-4 mr-2" />New Template
            </Button>
          </CardHeader>
          <CardContent>
            {templates.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
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
                        <div className="font-medium" style={{ color: TEXT_DARK }}>{template.templateName}</div>
                        <Badge className="mt-1">{template.templateType}</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingTemplate(template); setIsTemplateDialogOpen(true); }}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteTemplateMutation.mutate(template.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2 text-sm text-slate-500 whitespace-pre-wrap bg-gray-50 p-2 rounded">
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
            <CardTitle className="text-lg" style={{ color: TEXT_DARK }}>Message History</CardTitle>
          </CardHeader>
          <CardContent>
            {messageLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
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
                            <div className="text-xs text-slate-500">{log.recipientPhone}</div>
                          </div>
                          <Badge
                            variant={log.deliveryStatus === 'delivered' || log.deliveryStatus === 'read' ? 'default' : log.deliveryStatus === 'failed' ? 'destructive' : 'secondary'}
                            className="shrink-0"
                          >
                            {log.deliveryStatus}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <Badge variant="outline">{log.messageType}</Badge>
                          <span className="text-slate-500">{log.sentAt ? format(parseISO(log.sentAt), 'MMM d, h:mm a') : '-'}</span>
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
                            <div className="text-sm text-slate-500">{log.recipientPhone}</div>
                          </TableCell>
                          <TableCell><Badge variant="outline">{log.messageType}</Badge></TableCell>
                          <TableCell>
                            <Badge variant={log.deliveryStatus === 'delivered' || log.deliveryStatus === 'read' ? 'default' : log.deliveryStatus === 'failed' ? 'destructive' : 'secondary'}>
                              {log.deliveryStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-slate-500">
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
              <Input id="templateName" name="templateName" defaultValue={editingTemplate?.templateName || ''} required placeholder="e.g., Welcome Greeting" data-testid="input-template-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="templateType">Type</Label>
              <Select name="templateType" defaultValue={editingTemplate?.templateType || 'greeting'}>
                <SelectTrigger data-testid="select-template-type"><SelectValue /></SelectTrigger>
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
                defaultValue={editingTemplate?.messageContent || `Namaste {{guestName}},\n\nWelcome to the celebration! We're delighted to assist with your RSVP for {{eventName}} on {{eventDate}} at {{venue}}.\n\nPlease let us know if you'll be joining us. We look forward to seeing you!\n\nWarm regards,\nThe Events Team`}
                required rows={8}
                placeholder="Use {{guestName}}, {{eventName}}, {{eventDate}}, {{venue}} for personalization"
                data-testid="input-template-content"
              />
              <p className="text-xs text-slate-500">
                Available variables: {"{{guestName}}"}, {"{{eventName}}"}, {"{{eventDate}}"}, {"{{venue}}"}
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTemplateDialogOpen(false)}>Cancel</Button>
              <Button type="submit" style={{ backgroundColor: TEAL }} data-testid="save-template-btn">
                {editingTemplate ? 'Update' : 'Create'} Template
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface KnotviteEvent {
  id: string;
  userId: string;
  companyId: string;
  title: string;
  eventType: string | null;
  date: string | null;
  endDate: string | null;
  venue: string | null;
  city: string | null;
  description: string | null;
  groomName: string | null;
  brideName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  status: string;
  guestCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface PlanLimitsInfo {
  plan: string;
  limits: {
    maxEvents: number;
    maxGuestsPerForm: number;
    maxForms: number;
    maxCustomFields: number;
    canExportExcel: boolean;
    canBulkImport: boolean;
    canRemoveBranding: boolean;
    canUseWhatsApp: boolean;
    canUseQrCheckin: boolean;
    canUseWeddingPage: boolean;
    canUseCustomDomain: boolean;
    canUseWhatsAppAutomation: boolean;
  };
  usage: { events: number };
}

export default function KnotViteDashboard() {
  const [, navigate] = useLocation();
  const [mainTab, setMainTab] = useState("dashboard");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [eventComboOpen, setEventComboOpen] = useState(false);
  const [isGuestDialogOpen, setIsGuestDialogOpen] = useState(false);
  const [isResponseDialogOpen, setIsResponseDialogOpen] = useState(false);
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [editingKvEvent, setEditingKvEvent] = useState<KnotviteEvent | null>(null);
  const [editingGuest, setEditingGuest] = useState<EventGuest | null>(null);
  const [editingResponse, setEditingResponse] = useState<RsvpResponse | null>(null);
  const [guestToDelete, setGuestToDelete] = useState<EventGuest | null>(null);
  const [eventToDelete, setEventToDelete] = useState<KnotviteEvent | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [individualMsgGuest, setIndividualMsgGuest] = useState<EventGuest | null>(null);
  const [individualMessage, setIndividualMessage] = useState("");
  const [isSendingIndividual, setIsSendingIndividual] = useState(false);

  const queryClient = useQueryClient();
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const isSuperAdmin = user?.role === 'superadmin';
  const [trialBannerDismissed, setTrialBannerDismissed] = useState(false);

  const { data: billingStatus } = useQuery({
    queryKey: ['/api/knotvite/billing/status'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/knotvite/billing/status', { headers, credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 60000,
  });

  const { data: kvEvents = [] } = useQuery<KnotviteEvent[]>({
    queryKey: ['/api/knotvite/events'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/knotvite/events', { headers, credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: planLimits } = useQuery<PlanLimitsInfo>({
    queryKey: ['/api/knotvite/events-limits'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/knotvite/events-limits', { headers, credentials: 'include' });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const events: Event[] = kvEvents.map(e => ({
    id: e.id,
    title: e.title,
    customer: e.groomName && e.brideName ? `${e.groomName} & ${e.brideName}` : e.title,
    date: e.date || '',
    venue: e.venue || undefined,
    status: e.status,
  }));

  const selectedEvent = events.find(e => e.id === selectedEventId);
  const selectedKvEvent = kvEvents.find(e => e.id === selectedEventId);

  const createEventMutation = useMutation({
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/knotvite/events', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create event');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/knotvite/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/knotvite/events-limits'] });
      setIsEventDialogOpen(false);
      setEditingKvEvent(null);
      setSelectedEventId(data.id);
      toast({ title: "Event created successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/knotvite/events/${id}`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knotvite/events'] });
      setIsEventDialogOpen(false);
      setEditingKvEvent(null);
      toast({ title: "Event updated" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/knotvite/events/${id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knotvite/events'] });
      queryClient.invalidateQueries({ queryKey: ['/api/knotvite/events-limits'] });
      setEventToDelete(null);
      if (selectedEventId === eventToDelete?.id) setSelectedEventId(null);
      toast({ title: "Event deleted" });
    },
  });

  const handleEventSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      title: formData.get('title') as string,
      eventType: formData.get('eventType') as string || 'wedding',
      date: formData.get('date') as string || undefined,
      endDate: formData.get('endDate') as string || undefined,
      venue: formData.get('venue') as string || undefined,
      city: formData.get('city') as string || undefined,
      groomName: formData.get('groomName') as string || undefined,
      brideName: formData.get('brideName') as string || undefined,
      contactPhone: formData.get('contactPhone') as string || undefined,
      contactEmail: formData.get('contactEmail') as string || undefined,
      description: formData.get('description') as string || undefined,
    };
    if (editingKvEvent) {
      updateEventMutation.mutate({ id: editingKvEvent.id, data });
    } else {
      createEventMutation.mutate(data);
    }
  };

  const canCreateEvent = !planLimits || (planLimits.usage.events < planLimits.limits.maxEvents);
  const maxGuests = planLimits?.limits?.maxGuestsPerForm || 200;

  const { data: guests = [], isLoading: guestsLoading } = useQuery<any[]>({
    queryKey: ['/api/knotvite/guests', selectedEventId],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/knotvite/guests?eventId=${selectedEventId}`, { headers });
      if (!res.ok) throw new Error('Failed to fetch guests');
      return res.json();
    },
    enabled: !!selectedEventId,
  });

  const responses: any[] = [];
  const responsesLoading = false;

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
    mutationFn: async (data: any) => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch('/api/knotvite/guests', {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to create guest');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knotvite/guests'] });
      setIsGuestDialogOpen(false);
      setEditingGuest(null);
      toast({ title: "Guest added successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateGuestMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/knotvite/guests/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update guest');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knotvite/guests'] });
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
      const token = localStorage.getItem('auth_token');
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`/api/knotvite/guests/${id}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error('Failed to delete guest');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/knotvite/guests'] });
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

  const sendIndividualMessage = async () => {
    if (!individualMsgGuest || !individualMessage.trim()) return;
    setIsSendingIndividual(true);
    try {
      const res = await fetch('/api/rsvp-send-individual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guestId: individualMsgGuest.id,
          phone: individualMsgGuest.phone,
          message: individualMessage,
          eventId: selectedEventId,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to send message');
      toast({ title: "Message sent successfully" });
      setIndividualMsgGuest(null);
      setIndividualMessage("");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsSendingIndividual(false);
    }
  };

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
      case 'yes': return <Badge className="bg-green-100 text-green-800">Confirmed</Badge>;
      case 'no': return <Badge className="bg-red-100 text-red-800">Declined</Badge>;
      case 'maybe': return <Badge className="bg-yellow-100 text-yellow-800">Maybe</Badge>;
      default: return <Badge className="bg-gray-100 text-gray-800">Pending</Badge>;
    }
  };

  const getMealBadge = (preference: string | undefined) => {
    switch (preference) {
      case 'vegetarian': return <Badge variant="outline" className="text-green-600 border-green-600">Veg</Badge>;
      case 'non_vegetarian': return <Badge variant="outline" className="text-red-600 border-red-600">Non-Veg</Badge>;
      case 'both': return <Badge variant="outline" className="text-orange-600 border-orange-600">Both</Badge>;
      default: return null;
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

  const trialDays = billingStatus?.trialDaysRemaining;
  const isTrial = billingStatus?.isTrial;
  const isTrialExpired = billingStatus?.isTrialExpired;
  const currentPlan = billingStatus?.plan || 'basic';
  const isActive = billingStatus?.isActive;
  const showTrialBanner = (isTrial || isTrialExpired) && !trialBannerDismissed;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {showTrialBanner && (
        <div
          className={`px-4 py-2.5 flex items-center justify-between text-sm ${
            isTrialExpired
              ? 'bg-red-500 text-white'
              : trialDays !== null && trialDays <= 3
                ? 'bg-amber-500 text-white'
                : 'bg-[#2FA4BC] text-white'
          }`}
          data-testid="trial-banner"
        >
          <div className="flex items-center gap-2 flex-wrap">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">
              {isTrialExpired
                ? 'Your free trial has expired.'
                : `${trialDays} day${trialDays !== 1 ? 's' : ''} left in your free trial.`}
            </span>
            <span className="hidden sm:inline opacity-90">
              {isTrialExpired
                ? 'Upgrade now to continue using KnotVite.'
                : 'Upgrade to unlock all premium features.'}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="bg-white text-gray-900 hover:bg-gray-100 h-7 text-xs font-semibold px-3"
              onClick={() => navigate("/knotvite/billing")}
              data-testid="banner-upgrade-btn"
            >
              <Crown className="w-3 h-3 mr-1" /> Upgrade Now
            </Button>
            {!isTrialExpired && (
              <button
                onClick={() => setTrialBannerDismissed(true)}
                className="text-white/70 hover:text-white p-0.5"
                data-testid="banner-dismiss"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="bg-white border-b sticky top-0 z-40">
        <div className="px-4 sm:px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#2FA4BC' }}>
              <Heart className="h-4 w-4 text-white fill-white" />
            </div>
            <span className="font-bold text-base" style={{ color: TEXT_DARK }} data-testid="dashboard-title">KnotVite</span>
            {currentPlan !== 'basic' && isActive && (
              <Badge className="bg-[#e0f4f8] text-[#2FA4BC] border-[#2FA4BC]/20 text-[10px] ml-1">{currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => navigate("/knotvite/billing")}
              data-testid="button-billing"
            >
              <CreditCard className="w-3.5 h-3.5 mr-1.5" /> Subscription & Billing
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 rounded-full bg-[#2FA4BC] text-white text-xs font-bold p-0" data-testid="user-menu-trigger">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="end">
                <div className="px-3 py-2 border-b">
                  <p className="text-sm font-medium truncate">{user?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{user?.email}</p>
                </div>
                <button
                  onClick={() => logout()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded"
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold" style={{ color: TEXT_DARK }}>RSVP Manager</h1>
            <p className="text-slate-500 mt-1 text-sm">
              Manage event guest lists and track RSVP responses
              {planLimits && (
                <span className="ml-2 text-xs">
                  ({planLimits.usage.events}/{planLimits.limits.maxEvents === 999999 ? 'Unlimited' : planLimits.limits.maxEvents} events used)
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => {
                if (!canCreateEvent) {
                  toast({ title: "Event limit reached", description: `Your ${planLimits?.plan || 'basic'} plan allows ${planLimits?.limits?.maxEvents || 1} event(s). Upgrade for more.`, variant: "destructive" });
                  return;
                }
                setEditingKvEvent(null);
                setIsEventDialogOpen(true);
              }}
              style={{ backgroundColor: TEAL }}
              className="text-white hover:brightness-110"
              data-testid="create-event-btn"
            >
              <Plus className="h-4 w-4 mr-1" /> New Event
            </Button>
            {events.length > 0 && (
              <Popover open={eventComboOpen} onOpenChange={setEventComboOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={eventComboOpen}
                    className="w-full sm:w-[280px] justify-between"
                    data-testid="event-selector"
                  >
                    {selectedEvent ? (selectedEvent.customer || selectedEvent.title) : "Select an event..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0">
                  <Command>
                    <CommandInput placeholder="Search by name or venue..." />
                    <CommandList className="max-h-[300px] overflow-y-auto">
                      <CommandEmpty>No events found.</CommandEmpty>
                      <CommandGroup>
                        {events.length > 1 && (
                          <CommandItem
                            value="all"
                            onSelect={() => { setSelectedEventId(null); setEventComboOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", !selectedEventId ? "opacity-100" : "opacity-0")} />
                            All Events
                          </CommandItem>
                        )}
                        {events.map((event) => (
                          <CommandItem
                            key={event.id}
                            value={`${event.customer || ''} ${event.title} ${event.venue || ''}`}
                            onSelect={() => { setSelectedEventId(event.id); setEventComboOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedEventId === event.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span className="font-medium">{event.customer || event.title}</span>
                              {event.venue && <span className="text-xs text-slate-500">{event.venue}</span>}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        {events.length === 0 ? (
          <Card className="bg-white">
            <CardContent className="py-16 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: TEAL_LIGHT }}>
                <Calendar className="h-8 w-8" style={{ color: TEAL }} />
              </div>
              <h3 className="text-lg font-semibold mb-2" style={{ color: TEXT_DARK }}>Create Your First Event</h3>
              <p className="text-slate-500 max-w-md mx-auto mb-6">
                Get started by creating an event. You can then add guests, manage RSVPs, and send invitations.
              </p>
              <Button
                onClick={() => { setEditingKvEvent(null); setIsEventDialogOpen(true); }}
                style={{ backgroundColor: TEAL }}
                className="text-white hover:brightness-110"
                data-testid="create-first-event-btn"
              >
                <Plus className="h-4 w-4 mr-2" /> Create Event
              </Button>
              {planLimits && (
                <p className="text-xs text-slate-400 mt-4">
                  Your {planLimits.plan} plan allows up to {planLimits.limits.maxEvents === 999999 ? 'unlimited' : planLimits.limits.maxEvents} event(s) and {planLimits.limits.maxGuestsPerForm === 999999 ? 'unlimited' : planLimits.limits.maxGuestsPerForm} guests per event.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
        <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <TabsList className="bg-white border w-full sm:w-auto overflow-x-auto">
              <TabsTrigger value="dashboard" data-testid="tab-dashboard">Dashboard</TabsTrigger>
              <TabsTrigger value="guests" data-testid="tab-guests">Guest List</TabsTrigger>
              <TabsTrigger value="responses" data-testid="tab-responses">Responses</TabsTrigger>
              <TabsTrigger value="follow-ups" data-testid="tab-followups">Follow-ups</TabsTrigger>
              <TabsTrigger value="outreach" data-testid="tab-outreach">Outreach</TabsTrigger>
              <TabsTrigger value="my-events" data-testid="tab-events">My Events</TabsTrigger>
            </TabsList>
          </div>

          {/* DASHBOARD TAB */}
          <TabsContent value="dashboard" className="space-y-4">
            {selectedEventId && stats ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  <Card className="bg-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-500">Total Invited</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5" style={{ color: TEAL }} />
                        <span className="text-2xl font-bold" style={{ color: TEXT_DARK }}>{stats.total}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="bg-white">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-slate-500">Confirmed</CardTitle>
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
                      <CardTitle className="text-sm font-medium text-slate-500">Declined</CardTitle>
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
                      <CardTitle className="text-sm font-medium text-slate-500">Maybe</CardTitle>
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
                      <CardTitle className="text-sm font-medium text-slate-500">Pending</CardTitle>
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
                      <CardTitle className="text-sm font-medium text-slate-500">Total Attendees</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5" style={{ color: TEAL }} />
                        <span className="text-2xl font-bold" style={{ color: TEXT_DARK }}>{stats.totalAttendees}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <Card className="bg-white">
                    <CardHeader>
                      <CardTitle className="text-lg" style={{ color: TEXT_DARK }}>Response Progress</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between mb-2">
                          <span className="text-sm text-slate-500">Response Rate</span>
                          <span className="text-sm font-medium" style={{ color: TEXT_DARK }}>
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
                      <CardTitle className="text-lg" style={{ color: TEXT_DARK }}>Logistics Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Hotel className="h-4 w-4 text-slate-500" />
                            <span className="text-sm" style={{ color: TEXT_DARK }}>Need Accommodation</span>
                          </div>
                          <Badge variant="secondary">{stats.needsAccommodation}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-slate-500" />
                            <span className="text-sm" style={{ color: TEXT_DARK }}>Need Transportation</span>
                          </div>
                          <Badge variant="secondary">{stats.needsTransportation}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="h-4 w-4 text-green-600" />
                            <span className="text-sm" style={{ color: TEXT_DARK }}>Vegetarian</span>
                          </div>
                          <Badge variant="secondary">{stats.vegetarian}</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <UtensilsCrossed className="h-4 w-4 text-red-600" />
                            <span className="text-sm" style={{ color: TEXT_DARK }}>Non-Vegetarian</span>
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
                  <Calendar className="h-12 w-12 mx-auto mb-4" style={{ color: TEAL }} />
                  <p className="text-lg mb-2" style={{ color: TEXT_DARK }}>Select an event to view RSVP dashboard</p>
                  <p className="text-sm text-slate-500">Use the dropdown above to choose an event</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* GUEST LIST TAB */}
          <TabsContent value="guests" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 gap-3">
              <div className="flex flex-col sm:flex-row gap-2 flex-1">
                <div className="relative flex-1 sm:flex-none">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
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
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="yes">Confirmed</SelectItem>
                    <SelectItem value="no">Declined</SelectItem>
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
                style={{ backgroundColor: TEAL }}
                className="w-full sm:w-auto"
                data-testid="add-guest-btn"
              >
                <Plus className="h-4 w-4 mr-2" />Add Guest
              </Button>
            </div>

            <Card className="bg-white">
              {guestsLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-slate-400" />
                </div>
              ) : filteredGuestsWithResponses.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
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
                            <div className="flex items-center gap-1 text-xs text-slate-500">
                              <Phone className="h-3 w-3 shrink-0" />
                              <span className="truncate">{guest.phone}</span>
                            </div>
                          </div>
                          <div className="shrink-0">
                            {getStatusBadge(response?.attendanceStatus || 'pending')}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                          {guest.relationship && <span>{guest.relationship}</span>}
                          {guest.guestGroup && <span>• {guest.guestGroup}</span>}
                          <span>• Max: {guest.maxAttendees}</span>
                          {response?.attendanceStatus === 'yes' && <span>• {response.numberOfAttendees} attending</span>}
                        </div>
                        <div className="flex justify-end gap-1 pt-1">
                          {(user?.role === 'superadmin' || user?.role === 'wedding_planner' || user?.role === 'admin' || user?.role === 'tenant_admin') && guest.phone && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                              const event = selectedEvent;
                              const defaultMsg = event
                                ? `Hello ${guest.name}! We're looking forward to seeing you at ${event.customer || event.title}. Please confirm your attendance.`
                                : `Hello ${guest.name}! Please confirm your attendance.`;
                              setIndividualMessage(defaultMsg);
                              setIndividualMsgGuest(guest);
                            }}>
                              <MessageSquare className="h-4 w-4 text-green-600" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingGuest(guest); setIsGuestDialogOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setGuestToDelete(guest)}>
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
                              <div className="flex items-center gap-1 text-sm"><Phone className="h-3 w-3" />{guest.phone}</div>
                              {guest.email && <div className="flex items-center gap-1 text-xs text-slate-500"><Mail className="h-3 w-3" />{guest.email}</div>}
                            </div>
                          </TableCell>
                          <TableCell>{guest.relationship || '-'}</TableCell>
                          <TableCell>{guest.guestGroup || '-'}</TableCell>
                          <TableCell>{guest.maxAttendees}</TableCell>
                          <TableCell>{getStatusBadge(response?.attendanceStatus || 'pending')}</TableCell>
                          <TableCell>{response?.attendanceStatus === 'yes' ? response.numberOfAttendees : '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              {(user?.role === 'superadmin' || user?.role === 'wedding_planner' || user?.role === 'admin' || user?.role === 'tenant_admin') && guest.phone && (
                                <Button variant="ghost" size="icon" onClick={() => {
                                  const event = selectedEvent;
                                  const defaultMsg = event
                                    ? `Hello ${guest.name}! We're looking forward to seeing you at ${event.customer || event.title}. Please confirm your attendance.`
                                    : `Hello ${guest.name}! Please confirm your attendance.`;
                                  setIndividualMessage(defaultMsg);
                                  setIndividualMsgGuest(guest);
                                }} title="Send WhatsApp message" data-testid={`whatsapp-guest-${guest.id}`}>
                                  <MessageSquare className="h-4 w-4 text-green-600" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => { setEditingGuest(guest); setIsGuestDialogOpen(true); }} data-testid={`edit-guest-${guest.id}`}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setGuestToDelete(guest)} data-testid={`delete-guest-${guest.id}`}>
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

          {/* RESPONSES TAB */}
          <TabsContent value="responses" className="space-y-4">
            <Card className="bg-white">
              {responsesLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto text-slate-400" />
                </div>
              ) : responses.length === 0 ? (
                <div className="text-center py-8 text-slate-500">No responses yet</div>
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
                                <div className="text-xs text-slate-500">{format(parseISO(response.respondedAt), 'MMM d, yyyy')}</div>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {getStatusBadge(response.attendanceStatus)}
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingResponse(response); setIsResponseDialogOpen(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          {response.attendanceStatus === 'yes' && (
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="text-slate-500">{response.numberOfAttendees} attending</span>
                              {response.mealPreference && <span>• {getMealBadge(response.mealPreference)}</span>}
                              {response.needsAccommodation && (
                                <Badge variant="outline" className="text-xs"><Hotel className="h-3 w-3 mr-1" />{response.accommodationNights || '?'} nights</Badge>
                              )}
                              {response.needsTransportation && (
                                <Badge variant="outline" className="text-xs"><Car className="h-3 w-3 mr-1" />Transport</Badge>
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
                                  {response.attendeeNames && <div className="text-xs text-slate-500">{response.attendeeNames}</div>}
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell>{getMealBadge(response.mealPreference)}</TableCell>
                            <TableCell>
                              {response.needsAccommodation ? (
                                <Badge variant="outline"><Hotel className="h-3 w-3 mr-1" />{response.accommodationNights || '?'} nights</Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              {response.needsTransportation ? (
                                <Badge variant="outline"><Car className="h-3 w-3 mr-1" />Yes</Badge>
                              ) : '-'}
                            </TableCell>
                            <TableCell><Badge variant="secondary" className="text-xs">{response.responseSource}</Badge></TableCell>
                            <TableCell className="text-sm text-slate-500">
                              {response.respondedAt ? format(parseISO(response.respondedAt), 'MMM d, yyyy') : '-'}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => { setEditingResponse(response); setIsResponseDialogOpen(true); }} data-testid={`edit-response-${response.id}`}>
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

          {/* FOLLOW-UPS TAB */}
          <TabsContent value="follow-ups" className="space-y-4">
            <Card className="bg-white">
              <CardHeader>
                <CardTitle className="text-lg" style={{ color: TEXT_DARK }}>Guests Needing Follow-up</CardTitle>
              </CardHeader>
              <CardContent>
                {responses.filter(r => r.needsHumanFollowUp).length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
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
                              <div className="text-sm text-slate-500">{guest?.phone}</div>
                              {response.escalationReason && (
                                <div className="mt-2 text-sm text-amber-800">
                                  <strong>Reason:</strong> {response.escalationReason}
                                </div>
                              )}
                            </div>
                            <Button size="sm" onClick={() => { setEditingResponse(response); setIsResponseDialogOpen(true); }}>
                              <MessageSquare className="h-4 w-4 mr-2" />Handle
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

          {/* OUTREACH TAB */}
          <TabsContent value="outreach" className="space-y-4">
            <OutreachTab eventId={selectedEventId} guests={guests} responses={responses} />
          </TabsContent>

          {/* MY EVENTS TAB */}
          <TabsContent value="my-events" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {kvEvents.map(evt => (
                <Card key={evt.id} className={cn("bg-white cursor-pointer transition-shadow hover:shadow-md", selectedEventId === evt.id && "ring-2")} style={selectedEventId === evt.id ? { borderColor: TEAL, ringColor: TEAL } : {}} data-testid={`event-card-${evt.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate" style={{ color: TEXT_DARK }}>{evt.title}</h3>
                        {evt.groomName && evt.brideName && (
                          <p className="text-sm text-slate-500">{evt.groomName} & {evt.brideName}</p>
                        )}
                      </div>
                      <div className="flex gap-1 flex-shrink-0 ml-2">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setEditingKvEvent(evt); setIsEventDialogOpen(true); }} data-testid={`edit-event-${evt.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={(e) => { e.stopPropagation(); setEventToDelete(evt); }} data-testid={`delete-event-${evt.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1 text-sm text-slate-500">
                      {evt.date && <div className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5" />{evt.date}</div>}
                      {evt.venue && <div className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />{evt.venue}{evt.city ? `, ${evt.city}` : ''}</div>}
                      {evt.eventType && <Badge variant="outline" className="text-xs mt-1">{evt.eventType}</Badge>}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-3 text-xs"
                      style={selectedEventId === evt.id ? { backgroundColor: TEAL, color: 'white' } : {}}
                      onClick={() => { setSelectedEventId(evt.id); setMainTab("dashboard"); }}
                      data-testid={`select-event-${evt.id}`}
                    >
                      {selectedEventId === evt.id ? 'Currently Selected' : 'Select Event'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
        )}
      </div>

      {/* ADD/EDIT GUEST DIALOG */}
      <Dialog open={isGuestDialogOpen} onOpenChange={setIsGuestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingGuest ? 'Edit Guest' : 'Add Guest'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGuestSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input id="name" name="name" defaultValue={editingGuest?.name || ''} required data-testid="input-guest-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone *</Label>
              <Input id="phone" name="phone" defaultValue={editingGuest?.phone || ''} required placeholder="+91 9876543210" data-testid="input-guest-phone" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={editingGuest?.email || ''} data-testid="input-guest-email" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="relationship">Relationship</Label>
                <Select name="relationship" defaultValue={editingGuest?.relationship || ''}>
                  <SelectTrigger data-testid="select-relationship"><SelectValue placeholder="Select..." /></SelectTrigger>
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
                <Input id="guestGroup" name="guestGroup" defaultValue={editingGuest?.guestGroup || ''} placeholder="e.g., VIP" data-testid="input-guest-group" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="invitedBy">Invited By</Label>
                <Input id="invitedBy" name="invitedBy" defaultValue={editingGuest?.invitedBy || ''} placeholder="Bride, Groom, etc." data-testid="input-invited-by" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxAttendees">Max Attendees</Label>
                <Input id="maxAttendees" name="maxAttendees" type="number" min="1" defaultValue={editingGuest?.maxAttendees || 1} data-testid="input-max-attendees" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" name="notes" defaultValue={editingGuest?.notes || ''} placeholder="Internal notes about the guest..." data-testid="input-guest-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsGuestDialogOpen(false)}>Cancel</Button>
              <Button type="submit" style={{ backgroundColor: TEAL }} data-testid="save-guest-btn">
                {editingGuest ? 'Update' : 'Add Guest'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT RESPONSE DIALOG */}
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
                  <SelectTrigger data-testid="select-attendance"><SelectValue /></SelectTrigger>
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
                <Input id="numberOfAttendees" name="numberOfAttendees" type="number" min="1" defaultValue={editingResponse?.numberOfAttendees || 1} data-testid="input-num-attendees" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="attendeeNames">Attendee Names</Label>
              <Input id="attendeeNames" name="attendeeNames" defaultValue={editingResponse?.attendeeNames || ''} placeholder="Comma-separated names" data-testid="input-attendee-names" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="mealPreference">Meal Preference</Label>
                <Select name="mealPreference" defaultValue={editingResponse?.mealPreference || ''}>
                  <SelectTrigger data-testid="select-meal"><SelectValue placeholder="Select..." /></SelectTrigger>
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
                <Input id="dietaryRestrictions" name="dietaryRestrictions" defaultValue={editingResponse?.dietaryRestrictions || ''} placeholder="Allergies, etc." data-testid="input-dietary" />
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center gap-2">
                <Checkbox id="needsAccommodation" name="needsAccommodation" defaultChecked={editingResponse?.needsAccommodation || false} data-testid="check-accommodation" />
                <Label htmlFor="needsAccommodation">Accommodation</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="needsTransportation" name="needsTransportation" defaultChecked={editingResponse?.needsTransportation || false} data-testid="check-transportation" />
                <Label htmlFor="needsTransportation">Transportation</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="accommodationNights">Nights</Label>
                <Input id="accommodationNights" name="accommodationNights" type="number" min="1" defaultValue={editingResponse?.accommodationNights || ''} data-testid="input-accommodation-nights" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transportationDetails">Transport Details</Label>
                <Input id="transportationDetails" name="transportationDetails" defaultValue={editingResponse?.transportationDetails || ''} placeholder="Details..." data-testid="input-transport-details" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="specialNotes">Special Notes</Label>
              <Textarea id="specialNotes" name="specialNotes" defaultValue={editingResponse?.specialNotes || ''} placeholder="Any special requests..." data-testid="input-special-notes" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="humanNotes">Follow-up Notes</Label>
              <Textarea id="humanNotes" name="humanNotes" defaultValue={editingResponse?.humanNotes || ''} placeholder="Notes from follow-up..." data-testid="input-human-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsResponseDialogOpen(false)}>Cancel</Button>
              <Button type="submit" style={{ backgroundColor: TEAL }} data-testid="save-response-btn">Update Response</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE/EDIT EVENT DIALOG */}
      <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingKvEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEventSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Event Title *</Label>
              <Input id="title" name="title" defaultValue={editingKvEvent?.title || ''} required placeholder="e.g., Sharma & Patel Wedding" data-testid="input-event-title" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eventType">Event Type</Label>
                <Select name="eventType" defaultValue={editingKvEvent?.eventType || 'wedding'}>
                  <SelectTrigger data-testid="select-event-type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wedding">Wedding</SelectItem>
                    <SelectItem value="engagement">Engagement</SelectItem>
                    <SelectItem value="reception">Reception</SelectItem>
                    <SelectItem value="sangeet">Sangeet</SelectItem>
                    <SelectItem value="mehndi">Mehndi</SelectItem>
                    <SelectItem value="haldi">Haldi</SelectItem>
                    <SelectItem value="birthday">Birthday</SelectItem>
                    <SelectItem value="anniversary">Anniversary</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Event Date</Label>
                <Input id="date" name="date" type="date" defaultValue={editingKvEvent?.date || ''} data-testid="input-event-date" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="groomName">Groom's Name</Label>
                <Input id="groomName" name="groomName" defaultValue={editingKvEvent?.groomName || ''} placeholder="Groom's name" data-testid="input-groom-name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brideName">Bride's Name</Label>
                <Input id="brideName" name="brideName" defaultValue={editingKvEvent?.brideName || ''} placeholder="Bride's name" data-testid="input-bride-name" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="venue">Venue</Label>
                <Input id="venue" name="venue" defaultValue={editingKvEvent?.venue || ''} placeholder="Venue name" data-testid="input-event-venue" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" name="city" defaultValue={editingKvEvent?.city || ''} placeholder="City" data-testid="input-event-city" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input id="contactPhone" name="contactPhone" defaultValue={editingKvEvent?.contactPhone || ''} placeholder="+91 9876543210" data-testid="input-event-phone" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input id="contactEmail" name="contactEmail" type="email" defaultValue={editingKvEvent?.contactEmail || ''} placeholder="contact@example.com" data-testid="input-event-email" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" name="description" defaultValue={editingKvEvent?.description || ''} placeholder="Event details..." rows={3} data-testid="input-event-description" />
            </div>
            {planLimits && (
              <div className="text-xs text-slate-400 bg-slate-50 rounded p-2">
                Your {planLimits.plan} plan: {planLimits.limits.maxEvents === 999999 ? 'Unlimited' : planLimits.limits.maxEvents} events, {planLimits.limits.maxGuestsPerForm === 999999 ? 'unlimited' : planLimits.limits.maxGuestsPerForm} guests per event
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEventDialogOpen(false)}>Cancel</Button>
              <Button type="submit" style={{ backgroundColor: TEAL }} className="text-white" data-testid="save-event-btn">
                {editingKvEvent ? 'Update Event' : 'Create Event'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE EVENT CONFIRM */}
      <AlertDialog open={!!eventToDelete} onOpenChange={(open) => !open && setEventToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{eventToDelete?.title}</strong>? This will also remove all associated guests and RSVP data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => eventToDelete && deleteEventMutation.mutate(eventToDelete.id)}
            >
              Delete Event
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DELETE GUEST CONFIRM */}
      <AlertDialog open={!!guestToDelete} onOpenChange={(open) => !open && setGuestToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Guest</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{guestToDelete?.name}</strong> from the guest list? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => guestToDelete && deleteGuestMutation.mutate(guestToDelete.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* INDIVIDUAL WHATSAPP MESSAGE DIALOG */}
      <Dialog open={!!individualMsgGuest} onOpenChange={(open) => { if (!open) { setIndividualMsgGuest(null); setIndividualMessage(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Send WhatsApp Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>To</Label>
              <p className="text-sm text-slate-500">{individualMsgGuest?.name} ({individualMsgGuest?.phone})</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="individualMsg">Message</Label>
              <Textarea
                id="individualMsg"
                value={individualMessage}
                onChange={(e) => setIndividualMessage(e.target.value)}
                rows={5}
                placeholder="Type your message..."
                data-testid="individual-message-input"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIndividualMsgGuest(null); setIndividualMessage(""); }}>Cancel</Button>
              <Button
                style={{ backgroundColor: TEAL }}
                onClick={sendIndividualMessage}
                disabled={isSendingIndividual || !individualMessage.trim()}
                data-testid="send-individual-msg-btn"
              >
                {isSendingIndividual ? <><RefreshCw className="h-4 w-4 mr-2 animate-spin" />Sending...</> : <><Send className="h-4 w-4 mr-2" />Send</>}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

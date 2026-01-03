import { useState, useEffect } from "react";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Shield, Trash2, ChevronDown, ChevronUp, Pencil, Plus, Tag, Calendar, UserPlus, Copy, Eye, EyeOff, Users, Phone, Mail, MapPin, Building2, RefreshCw, CheckCircle2, XCircle, Loader2, CalendarSync } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { format } from "date-fns";
import { PhotoUploader } from "@/components/PhotoUploader";
import { MessagingTab } from "@/components/MessagingTab";

type PublicHoliday = {
  id: string;
  name: string;
  date: string;
  year: number;
  isNational: boolean;
  createdBy: string | null;
};

type LeaveCategory = {
  id: string;
  name: string;
  description: string | null;
  defaultAnnualAllowance: number;
  isSystem: boolean;
  createdBy: string | null;
  createdAt: string | null;
};

const ALL_PAGES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "event-calendar", label: "Event Calendar" },
  { id: "team-calendar", label: "Team Calendar" },
  { id: "event-database", label: "Event Database" },
  { id: "event-milestones", label: "Event Milestones" },
  { id: "daybook", label: "Daybook" },
  { id: "oak-book", label: "Oak Book" },
  { id: "oak-sales", label: "Oak Sales" },
  { id: "oak-inventory", label: "Oak Inventory" },
  { id: "execution-plan", label: "Execution Plan" },
  { id: "hr", label: "HR" },
  { id: "employee-portal", label: "Employee Portal" },
  { id: "oaksy", label: "Oaksy AI" },
  { id: "oak-creative", label: "Oak Creative" },
  { id: "admin", label: "Admin" },
];

type Role = {
  id: string;
  name: string;
  label: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string | null;
};

type GoogleCalendar = {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
};

type Event = {
  id: string;
  title: string;
  date: string;
  time?: string | null;
  type: string;
  customer: string;
  venue: string;
  planner: string;
  googleCalendarEventId?: string | null;
  outlookCalendarEventId?: string | null;
};

type ChecklistTemplate = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  isDefault: boolean | null;
  createdBy: string | null;
  updatedAt: Date | null;
  createdAt: Date | null;
};

type ChecklistTemplateItem = {
  id: string;
  templateId: string;
  slNo: number | null;
  sectionLabel: string | null;
  isSection: boolean | null;
  itemDescription: string;
  quantity: number | null;
  vendorName: string | null;
  sortOrder: number | null;
  createdAt: Date | null;
};

type BroadcastNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  actionUrl: string | null;
  audienceType: string;
  audienceRoles: string[] | null;
  audienceUserIds: string[] | null;
  createdBy: string | null;
  createdAt: string;
};

function NotificationsTab() {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [actionUrl, setActionUrl] = useState('');
  const [audienceType, setAudienceType] = useState('all');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const { data: notifications = [], isLoading } = useQuery<BroadcastNotification[]>({
    queryKey: ['/api/notifications/all'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/all', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
  });

  const broadcastMutation = useMutation({
    mutationFn: async (data: {
      title: string;
      message: string;
      type: string;
      actionUrl?: string;
      audienceType: string;
      audienceRoles?: string[];
      audienceUserIds?: string[];
    }) => {
      const res = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to broadcast notification');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/all'] });
      setTitle('');
      setMessage('');
      setType('info');
      setActionUrl('');
      setAudienceType('all');
      setSelectedRoles([]);
      setSelectedUserIds([]);
      alert(`Notification sent to ${data.recipientCount} users`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete notification');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications/all'] });
    },
  });

  const handleBroadcast = () => {
    if (!title || !message) return;
    broadcastMutation.mutate({
      title,
      message,
      type,
      actionUrl: actionUrl || undefined,
      audienceType,
      audienceRoles: audienceType === 'roles' ? selectedRoles : undefined,
      audienceUserIds: audienceType === 'specific' ? selectedUserIds : undefined,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Broadcast Notification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input
                placeholder="Notification title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                data-testid="input-notification-title"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger data-testid="select-notification-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Message *</Label>
            <Textarea
              placeholder="Notification message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              data-testid="input-notification-message"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Action URL (optional)</Label>
              <Input
                placeholder="/path or https://..."
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                data-testid="input-notification-url"
              />
            </div>
            <div className="space-y-2">
              <Label>Audience</Label>
              <Select value={audienceType} onValueChange={setAudienceType}>
                <SelectTrigger data-testid="select-notification-audience">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="roles">Specific Roles</SelectItem>
                  <SelectItem value="specific">Specific Users</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {audienceType === 'roles' && (
            <div className="space-y-2">
              <Label>Select Roles</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-md">
                {roles.map((role) => (
                  <label key={role.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedRoles.includes(role.name)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedRoles([...selectedRoles, role.name]);
                        } else {
                          setSelectedRoles(selectedRoles.filter(r => r !== role.name));
                        }
                      }}
                    />
                    <span className="text-sm">{role.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {audienceType === 'specific' && (
            <div className="space-y-2">
              <Label>Select Users</Label>
              <div className="flex flex-wrap gap-2 p-3 border rounded-md max-h-48 overflow-y-auto">
                {users.map((user) => (
                  <label key={user.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={selectedUserIds.includes(user.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedUserIds([...selectedUserIds, user.id]);
                        } else {
                          setSelectedUserIds(selectedUserIds.filter(id => id !== user.id));
                        }
                      }}
                    />
                    <span className="text-sm">{user.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <Button
            onClick={handleBroadcast}
            disabled={!title || !message || broadcastMutation.isPending}
            className="bg-[#6b9937] hover:bg-[#5a8230]"
            data-testid="button-broadcast-notification"
          >
            {broadcastMutation.isPending ? 'Sending...' : 'Broadcast Notification'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sent Notifications</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading...</p>
          ) : notifications.length === 0 ? (
            <p className="text-muted-foreground">No notifications sent yet.</p>
          ) : (
            <div className="space-y-3">
              {notifications.map((n) => (
                <div key={n.id} className="flex items-start justify-between p-3 border rounded-md">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{n.title}</span>
                      <Badge variant={
                        n.type === 'success' ? 'default' :
                        n.type === 'warning' ? 'secondary' :
                        n.type === 'error' ? 'destructive' : 'outline'
                      }>
                        {n.type}
                      </Badge>
                      <Badge variant="outline">
                        {n.audienceType === 'all' ? 'All Users' :
                         n.audienceType === 'roles' ? `Roles: ${n.audienceRoles?.join(', ')}` :
                         `${n.audienceUserIds?.length} users`}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{n.message}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      {n.createdAt && format(new Date(n.createdAt), 'PPp')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (confirm('Delete this notification?')) {
                        deleteMutation.mutate(n.id);
                      }
                    }}
                    data-testid={`button-delete-notification-${n.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ChecklistTemplatesTab() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);
  const [templateItems, setTemplateItems] = useState<ChecklistTemplateItem[]>([]);
  const [newTemplate, setNewTemplate] = useState({ name: '', description: '', category: '' });
  const [newItem, setNewItem] = useState({ itemDescription: '', quantity: 1, vendorName: '', sectionLabel: '', isSection: false });

  const { data: templates = [], isLoading } = useQuery<ChecklistTemplate[]>({
    queryKey: ['/api/checklist-templates'],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; category: string }) => {
      const res = await fetch('/api/checklist-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/checklist-templates'] });
      setIsDialogOpen(false);
      setNewTemplate({ name: '', description: '', category: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/checklist-templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/checklist-templates'] });
    },
  });

  const fetchTemplateItems = async (templateId: string) => {
    const res = await fetch(`/api/checklist-templates/${templateId}`);
    const data = await res.json();
    setTemplateItems(data.items || []);
  };

  const addItemMutation = useMutation({
    mutationFn: async (data: { templateId: string; itemDescription: string; quantity: number; vendorName: string; sectionLabel: string; isSection: boolean; sortOrder: number }) => {
      const res = await fetch('/api/checklist-template-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to add item');
      return res.json();
    },
    onSuccess: () => {
      if (selectedTemplate) {
        fetchTemplateItems(selectedTemplate.id);
      }
      setNewItem({ itemDescription: '', quantity: 1, vendorName: '', sectionLabel: '', isSection: false });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/checklist-template-items/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete item');
      return res.json();
    },
    onSuccess: () => {
      if (selectedTemplate) {
        fetchTemplateItems(selectedTemplate.id);
      }
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Checklist Templates
        </CardTitle>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1" data-testid="button-add-template">
              <Plus className="h-4 w-4" /> New Template
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Checklist Template</DialogTitle>
              <DialogDescription>Create a reusable checklist template for execution plans</DialogDescription>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(newTemplate); }} className="space-y-4">
              <div className="space-y-2">
                <Label>Template Name</Label>
                <Input 
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                  placeholder="e.g., Ramada Wedding Setup"
                  required
                  data-testid="input-template-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={newTemplate.description}
                  onChange={(e) => setNewTemplate({ ...newTemplate, description: e.target.value })}
                  placeholder="Brief description of this template"
                  data-testid="input-template-description"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Input 
                  value={newTemplate.category}
                  onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value })}
                  placeholder="e.g., Wedding, Corporate, Birthday"
                  data-testid="input-template-category"
                />
              </div>
              <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-create-template">
                {createMutation.isPending ? 'Creating...' : 'Create Template'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : templates.length === 0 ? (
          <p className="text-muted-foreground text-center py-4">No templates created yet. Create your first template to get started.</p>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <div key={template.id} className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                <div className="space-y-1">
                  <div className="font-medium">{template.name}</div>
                  {template.description && <p className="text-sm text-muted-foreground">{template.description}</p>}
                  {template.category && <Badge variant="secondary" className="text-xs">{template.category}</Badge>}
                </div>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {
                      setSelectedTemplate(template);
                      fetchTemplateItems(template.id);
                      setIsEditDialogOpen(true);
                    }}
                    data-testid={`button-edit-template-${template.id}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => {
                      if (confirm('Delete this template?')) {
                        deleteMutation.mutate(template.id);
                      }
                    }}
                    data-testid={`button-delete-template-${template.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => { setIsEditDialogOpen(open); if (!open) { setSelectedTemplate(null); setTemplateItems([]); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template: {selectedTemplate?.name}</DialogTitle>
            <DialogDescription>Add, edit, or remove items from this template</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="border rounded-lg">
              <div className="p-3 bg-muted/50 border-b font-medium">Template Items ({templateItems.length})</div>
              <div className="max-h-[300px] overflow-y-auto">
                {templateItems.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No items yet</p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-muted/30 sticky top-0">
                      <tr className="border-b">
                        <th className="p-2 text-left text-sm font-medium">#</th>
                        <th className="p-2 text-left text-sm font-medium">Description</th>
                        <th className="p-2 text-left text-sm font-medium">Qty</th>
                        <th className="p-2 text-left text-sm font-medium">Vendor</th>
                        <th className="p-2 text-center text-sm font-medium w-16">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {templateItems.map((item, idx) => (
                        <tr key={item.id} className={`border-b ${item.isSection ? 'bg-primary/10 font-semibold' : ''}`}>
                          <td className="p-2 text-sm">{item.isSection ? '' : item.slNo || idx + 1}</td>
                          <td className="p-2 text-sm">{item.isSection ? `[${item.sectionLabel}]` : item.itemDescription}</td>
                          <td className="p-2 text-sm">{item.isSection ? '-' : item.quantity || 1}</td>
                          <td className="p-2 text-sm">{item.isSection ? '-' : item.vendorName || '-'}</td>
                          <td className="p-2 text-center">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => deleteItemMutation.mutate(item.id)}>
                              <Trash2 className="h-3 w-3 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="border rounded-lg p-4 space-y-4">
              <div className="font-medium">Add New Item</div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="isSection" 
                  checked={newItem.isSection}
                  onCheckedChange={(checked) => setNewItem({ ...newItem, isSection: checked as boolean })}
                />
                <Label htmlFor="isSection" className="text-sm">This is a section header</Label>
              </div>
              
              {newItem.isSection ? (
                <div className="space-y-2">
                  <Label>Section Name</Label>
                  <Input 
                    value={newItem.sectionLabel}
                    onChange={(e) => setNewItem({ ...newItem, sectionLabel: e.target.value, itemDescription: e.target.value })}
                    placeholder="e.g., Lighting, Stage, Seating"
                    data-testid="input-section-name"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Item Description</Label>
                    <Input 
                      value={newItem.itemDescription}
                      onChange={(e) => setNewItem({ ...newItem, itemDescription: e.target.value })}
                      placeholder="e.g., Par Lights 200W"
                      data-testid="input-item-description"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantity</Label>
                    <Input 
                      type="number"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem({ ...newItem, quantity: parseInt(e.target.value) || 1 })}
                      min={1}
                      data-testid="input-item-quantity"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vendor</Label>
                    <Input 
                      value={newItem.vendorName}
                      onChange={(e) => setNewItem({ ...newItem, vendorName: e.target.value })}
                      placeholder="e.g., Oak Production"
                      data-testid="input-item-vendor"
                    />
                  </div>
                </div>
              )}
              
              <Button 
                onClick={() => {
                  if (selectedTemplate && (newItem.itemDescription || newItem.sectionLabel)) {
                    addItemMutation.mutate({
                      templateId: selectedTemplate.id,
                      itemDescription: newItem.isSection ? newItem.sectionLabel : newItem.itemDescription,
                      quantity: newItem.isSection ? 0 : newItem.quantity,
                      vendorName: newItem.vendorName,
                      sectionLabel: newItem.isSection ? newItem.sectionLabel : '',
                      isSection: newItem.isSection,
                      sortOrder: templateItems.length,
                    });
                  }
                }}
                disabled={addItemMutation.isPending}
                className="w-full"
                data-testid="button-add-item"
              >
                {addItemMutation.isPending ? 'Adding...' : 'Add Item'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function CalendarIntegrationTab() {
  const queryClient = useQueryClient();
  const [selectedCalendar, setSelectedCalendar] = useState<string>('primary');
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: googleStatus, isLoading: statusLoading } = useQuery<{ connected: boolean }>({
    queryKey: ['/api/calendar/google/status'],
  });

  const { data: calendars = [], isLoading: calendarsLoading } = useQuery<GoogleCalendar[]>({
    queryKey: ['/api/calendar/google/calendars'],
    enabled: googleStatus?.connected === true,
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/calendar/google/sync-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId: selectedCalendar }),
      });
      if (!res.ok) throw new Error('Failed to sync events');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      alert(`Synced ${data.synced} events to Google Calendar${data.failed > 0 ? ` (${data.failed} failed)` : ''}`);
    },
    onError: (error: Error) => {
      alert('Error syncing events: ' + error.message);
    },
  });

  const syncEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await fetch(`/api/calendar/google/sync/${eventId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId: selectedCalendar }),
      });
      if (!res.ok) throw new Error('Failed to sync event');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
    },
  });

  const syncedCount = events.filter(e => e.googleCalendarEventId).length;
  const unsyncedCount = events.length - syncedCount;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Google Calendar Integration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking connection status...
            </div>
          ) : googleStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Connected to Google Calendar</span>
              </div>

              {calendarsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading calendars...
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Select Calendar for Sync</Label>
                  <Select value={selectedCalendar} onValueChange={setSelectedCalendar}>
                    <SelectTrigger data-testid="select-calendar">
                      <SelectValue placeholder="Select a calendar" />
                    </SelectTrigger>
                    <SelectContent>
                      {calendars.map((cal) => (
                        <SelectItem key={cal.id} value={cal.id}>
                          {cal.summary} {cal.primary && '(Primary)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-green-600">{syncedCount}</div>
                    <div className="text-sm text-muted-foreground">Synced Events</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-2xl font-bold text-amber-600">{unsyncedCount}</div>
                    <div className="text-sm text-muted-foreground">Not Synced</div>
                  </CardContent>
                </Card>
              </div>

              <Button 
                onClick={() => syncAllMutation.mutate()}
                disabled={syncAllMutation.isPending || events.length === 0}
                className="w-full gap-2"
                data-testid="button-sync-all"
              >
                {syncAllMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Syncing Events...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Sync All Events to Google Calendar
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-amber-600">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">Google Calendar not connected</span>
              </div>
              <p className="text-sm text-muted-foreground">
                To connect Google Calendar, please set up the integration in your Replit project settings. 
                Once connected, you'll be able to sync your Oak events with Google Calendar.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {googleStatus?.connected && events.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Individual Event Sync</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {events.slice(0, 20).map((event) => (
                <div 
                  key={event.id} 
                  className="flex items-center justify-between p-2 bg-muted/50 rounded"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{event.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {event.date} • {event.customer}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {event.googleCalendarEventId ? (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Synced
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => syncEventMutation.mutate(event.id)}
                        disabled={syncEventMutation.isPending}
                        data-testid={`button-sync-event-${event.id}`}
                      >
                        {syncEventMutation.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          'Sync'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Calendar className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-blue-800 dark:text-blue-200">About Calendar Sync</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                When you sync events, they are created in your Google Calendar with the event details including 
                customer name, venue, event type, and planner. Updates to events in Oak will sync back to 
                Google Calendar when you re-sync.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Admin() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [isEditRoleDialogOpen, setIsEditRoleDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [editRole, setEditRole] = useState<string>('');
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'superadmin';

  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('employee');

  const [newRoleLabel, setNewRoleLabel] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');

  const [editRoleLabel, setEditRoleLabel] = useState('');
  const [editRoleDescription, setEditRoleDescription] = useState('');

  const [isHolidayDialogOpen, setIsHolidayDialogOpen] = useState(false);
  const [isEditHolidayDialogOpen, setIsEditHolidayDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<PublicHoliday | null>(null);
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayIsNational, setNewHolidayIsNational] = useState(true);
  const [editHolidayName, setEditHolidayName] = useState('');
  const [editHolidayDate, setEditHolidayDate] = useState('');
  const [editHolidayIsNational, setEditHolidayIsNational] = useState(true);

  // Leave Categories state
  const [isLeaveCategoryDialogOpen, setIsLeaveCategoryDialogOpen] = useState(false);
  const [isEditLeaveCategoryDialogOpen, setIsEditLeaveCategoryDialogOpen] = useState(false);
  const [editingLeaveCategory, setEditingLeaveCategory] = useState<LeaveCategory | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryDescription, setNewCategoryDescription] = useState('');
  const [newCategoryAllowance, setNewCategoryAllowance] = useState(12);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [editCategoryDescription, setEditCategoryDescription] = useState('');
  const [editCategoryAllowance, setEditCategoryAllowance] = useState(12);

  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credentialsAcknowledged, setCredentialsAcknowledged] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ employeeId: string; email: string; temporaryPassword: string } | null>(null);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    phone: '',
    whatsappNumber: '',
    dateOfBirth: '',
    photoUrl: null as string | null,
    joinDate: new Date().toISOString().split('T')[0],
    designation: '',
    department: '',
    salary: '',
    address: '',
    emergencyContact: '',
    managerUserId: '',
    bankAccountNumber: '',
    bankIfscCode: '',
    panNumber: '',
    duties: '',
    responsibilities: '',
    totalLeavesPerYear: 24,
  });

  const resetEmployeeForm = () => {
    setNewEmployee({
      name: '',
      email: '',
      phone: '',
      whatsappNumber: '',
      dateOfBirth: '',
      photoUrl: null,
      joinDate: new Date().toISOString().split('T')[0],
      designation: '',
      department: '',
      salary: '',
      address: '',
      emergencyContact: '',
      managerUserId: '',
      bankAccountNumber: '',
      bankIfscCode: '',
      panNumber: '',
      duties: '',
      responsibilities: '',
      totalLeavesPerYear: 24,
    });
    setCreatedCredentials(null);
    setShowPassword(false);
    setCredentialsAcknowledged(false);
  };

  const { data: users = [], isLoading: usersLoading, error: usersError } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users', {
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: roles = [], isLoading: rolesLoading, error: rolesError } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
    queryFn: async () => {
      const res = await fetch('/api/roles', {
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) throw new Error('Failed to fetch roles');
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: true,
  });

  const { data: holidays = [], isLoading: holidaysLoading } = useQuery<PublicHoliday[]>({
    queryKey: ['/api/public-holidays'],
    queryFn: async () => {
      const res = await fetch('/api/public-holidays', {
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) throw new Error('Failed to fetch holidays');
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: true,
    enabled: isSuperAdmin,
  });

  const { data: leaveCategories = [], isLoading: leaveCategoriesLoading } = useQuery<LeaveCategory[]>({
    queryKey: ['/api/leave-categories'],
    queryFn: async () => {
      const res = await fetch('/api/leave-categories', {
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) throw new Error('Failed to fetch leave categories');
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: true,
    enabled: isSuperAdmin,
  });

  const { data: managers = [] } = useQuery<{ id: string; name: string; email: string; role: string }[]>({
    queryKey: ['/api/admin/managers'],
    queryFn: async () => {
      const res = await fetch('/api/admin/managers', {
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) throw new Error('Failed to fetch managers');
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: true,
    enabled: isSuperAdmin,
  });

  const { data: usersWithoutEmployee = [], refetch: refetchUsersWithoutEmployee } = useQuery<{ id: string; name: string; email: string; role: string }[]>({
    queryKey: ['/api/admin/users-without-employee'],
    queryFn: async () => {
      const res = await fetch('/api/admin/users-without-employee', {
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) throw new Error('Failed to fetch users without employee');
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: true,
    enabled: isSuperAdmin,
  });

  type EmployeeData = {
    id: string;
    employeeId: string;
    name: string;
    email: string | null;
    phone: string | null;
    department: string | null;
    designation: string | null;
    joinDate: string | null;
    leaveDate: string | null;
    salary: string | null;
    address: string | null;
    photoUrl: string | null;
  };

  const { data: allEmployees = [], isLoading: employeesLoading } = useQuery<EmployeeData[]>({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees', {
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (!res.ok) throw new Error('Failed to fetch employees');
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: true,
    enabled: isSuperAdmin,
  });

  const currentEmployees = allEmployees.filter(emp => !emp.leaveDate).sort((a, b) => {
    const idA = parseInt(a.employeeId.replace(/\D/g, '')) || 0;
    const idB = parseInt(b.employeeId.replace(/\D/g, '')) || 0;
    return idB - idA;
  });

  const [isLinkUserDialogOpen, setIsLinkUserDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [linkEmployeeData, setLinkEmployeeData] = useState({
    phone: '',
    whatsappNumber: '',
    dateOfBirth: '',
    photoUrl: null as string | null,
    joinDate: new Date().toISOString().split('T')[0],
    designation: '',
    department: '',
    salary: '',
    address: '',
    emergencyContact: '',
    managerUserId: '',
    bankAccountNumber: '',
    bankIfscCode: '',
    panNumber: '',
    duties: '',
    responsibilities: '',
    totalLeavesPerYear: 24,
  });

  const resetLinkEmployeeForm = () => {
    setSelectedUserId('');
    setLinkEmployeeData({
      phone: '',
      whatsappNumber: '',
      dateOfBirth: '',
      photoUrl: null,
      joinDate: new Date().toISOString().split('T')[0],
      designation: '',
      department: '',
      salary: '',
      address: '',
      emergencyContact: '',
      managerUserId: '',
      bankAccountNumber: '',
      bankIfscCode: '',
      panNumber: '',
      duties: '',
      responsibilities: '',
      totalLeavesPerYear: 24,
    });
  };

  const linkUserToEmployeeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/admin/link-user-to-employee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to link user to employee');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users-without-employee'] });
      setIsLinkUserDialogOpen(false);
      resetLinkEmployeeForm();
    },
  });

  useEffect(() => {
    if (editingRole) {
      setEditRoleLabel(editingRole.label);
      setEditRoleDescription(editingRole.description || '');
    }
  }, [editingRole]);

  useEffect(() => {
    if (editingHoliday) {
      setEditHolidayName(editingHoliday.name);
      setEditHolidayDate(editingHoliday.date);
      setEditHolidayIsNational(editingHoliday.isNational);
    }
  }, [editingHoliday]);

  const getRoleLabel = (roleName: string) => {
    const role = roles.find(r => r.name === roleName);
    return role?.label || roleName;
  };

  const resetNewUserForm = () => {
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPassword('');
    setNewUserRole('employee');
  };

  const resetNewRoleForm = () => {
    setNewRoleLabel('');
    setNewRoleDescription('');
  };

  const resetNewHolidayForm = () => {
    setNewHolidayName('');
    setNewHolidayDate('');
    setNewHolidayIsNational(true);
  };

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; email: string; password: string; role: string }) => {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create user');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDialogOpen(false);
      resetNewUserForm();
    },
  });

  const createEmployeeMutation = useMutation({
    mutationFn: async (data: typeof newEmployee) => {
      const res = await fetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...data,
          salary: parseFloat(data.salary),
          managerUserId: data.managerUserId && data.managerUserId !== 'none' ? data.managerUserId : null,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create employee');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setCreatedCredentials(data.credentials);
    },
    onError: (error: Error) => {
      alert(error.message);
    },
  });

  const handleCreateEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    createEmployeeMutation.mutate(newEmployee);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard');
  };

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ userId, pageIds }: { userId: string; pageIds: string[] }) => {
      const res = await fetch(`/api/users/${userId}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageIds }),
      });
      if (!res.ok) throw new Error('Failed to update permissions');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete user');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) throw new Error('Failed to update user');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsEditDialogOpen(false);
      setEditingUser(null);
    },
  });

  const createRoleMutation = useMutation({
    mutationFn: async (data: { name: string; label: string; description: string }) => {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create role');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      setIsRoleDialogOpen(false);
      resetNewRoleForm();
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ id, label, description }: { id: string; label: string; description: string }) => {
      const res = await fetch(`/api/roles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label, description }),
      });
      if (!res.ok) throw new Error('Failed to update role');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
      setIsEditRoleDialogOpen(false);
      setEditingRole(null);
    },
  });

  const deleteRoleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/roles/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete role');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/roles'] });
    },
  });

  const createHolidayMutation = useMutation({
    mutationFn: async (data: { name: string; date: string; year: number; isNational: boolean }) => {
      const res = await fetch('/api/public-holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create holiday');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/public-holidays'] });
      setIsHolidayDialogOpen(false);
      resetNewHolidayForm();
    },
  });

  const updateHolidayMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string; date: string; year: number; isNational: boolean } }) => {
      const res = await fetch(`/api/public-holidays/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update holiday');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/public-holidays'] });
      setIsEditHolidayDialogOpen(false);
      setEditingHoliday(null);
    },
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/public-holidays/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete holiday');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/public-holidays'] });
    },
  });

  // Leave Category mutations
  const createLeaveCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; description: string; defaultAnnualAllowance: number }) => {
      const res = await fetch('/api/leave-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create leave category');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leave-categories'] });
      setIsLeaveCategoryDialogOpen(false);
      resetNewLeaveCategoryForm();
    },
  });

  const updateLeaveCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name?: string; description?: string; defaultAnnualAllowance?: number } }) => {
      const res = await fetch(`/api/leave-categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update leave category');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leave-categories'] });
      setIsEditLeaveCategoryDialogOpen(false);
      setEditingLeaveCategory(null);
    },
  });

  const deleteLeaveCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/leave-categories/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete leave category');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leave-categories'] });
    },
  });

  const resetNewLeaveCategoryForm = () => {
    setNewCategoryName('');
    setNewCategoryDescription('');
    setNewCategoryAllowance(12);
  };

  const openEditLeaveCategoryDialog = (category: LeaveCategory) => {
    setEditingLeaveCategory(category);
    setEditCategoryName(category.name);
    setEditCategoryDescription(category.description || '');
    setEditCategoryAllowance(category.defaultAnnualAllowance);
    setIsEditLeaveCategoryDialogOpen(true);
  };

  const handleCreateLeaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    createLeaveCategoryMutation.mutate({
      name: newCategoryName,
      description: newCategoryDescription,
      defaultAnnualAllowance: newCategoryAllowance,
    });
  };

  const handleUpdateLeaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingLeaveCategory) {
      updateLeaveCategoryMutation.mutate({
        id: editingLeaveCategory.id,
        data: {
          name: editingLeaveCategory.isSystem ? undefined : editCategoryName,
          description: editingLeaveCategory.isSystem ? undefined : editCategoryDescription,
          defaultAnnualAllowance: editCategoryAllowance,
        },
      });
    }
  };

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setEditRole(user.role);
    setIsEditDialogOpen(true);
  };

  const openEditRoleDialog = (role: Role) => {
    setEditingRole(role);
    setIsEditRoleDialogOpen(true);
  };

  const openEditHolidayDialog = (holiday: PublicHoliday) => {
    setEditingHoliday(holiday);
    setIsEditHolidayDialogOpen(true);
  };

  const handleCreateHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    const date = new Date(newHolidayDate);
    createHolidayMutation.mutate({
      name: newHolidayName,
      date: newHolidayDate,
      year: date.getFullYear(),
      isNational: newHolidayIsNational,
    });
  };

  const handleUpdateHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingHoliday) {
      const date = new Date(editHolidayDate);
      updateHolidayMutation.mutate({
        id: editingHoliday.id,
        data: {
          name: editHolidayName,
          date: editHolidayDate,
          year: date.getFullYear(),
          isNational: editHolidayIsNational,
        },
      });
    }
  };

  const handleUpdateUser = () => {
    if (editingUser && editRole) {
      updateUserMutation.mutate({ userId: editingUser.id, role: editRole });
    }
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      name: newUserName,
      email: newUserEmail,
      password: newUserPassword,
      role: newUserRole,
    });
  };

  const handleCreateRole = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newRoleLabel.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    createRoleMutation.mutate({
      name,
      label: newRoleLabel,
      description: newRoleDescription,
    });
  };

  const handleUpdateRole = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRole) {
      updateRoleMutation.mutate({
        id: editingRole.id,
        label: editRoleLabel,
        description: editRoleDescription,
      });
    }
  };

  const togglePermission = (userId: string, pageId: string, currentPages: string[]) => {
    const newPages = currentPages.includes(pageId)
      ? currentPages.filter(p => p !== pageId)
      : [...currentPages, pageId];
    updatePermissionsMutation.mutate({ userId, pageIds: newPages });
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold font-serif text-primary">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">User Access & Configuration</p>
        </div>
      </div>

      <Tabs defaultValue="users" className="w-full">
        <div className="overflow-x-auto -mx-2 px-2 pb-2">
          <TabsList className="inline-flex w-auto min-w-full sm:w-full h-auto flex-wrap sm:flex-nowrap gap-1">
            <TabsTrigger value="users" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-users">Users</TabsTrigger>
            {isSuperAdmin && <TabsTrigger value="employees" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-employees">Employees</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="roles" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-roles">Roles</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="holidays" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-holidays">Holidays</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="leave" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-leave">Leave</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="onboarding" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-onboarding">Onboarding</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="calendar" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-calendar">Calendar</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="messaging" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-messaging">Messaging</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="templates" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-templates">Templates</TabsTrigger>}
            {isSuperAdmin && <TabsTrigger value="notifications" className="text-xs sm:text-sm px-2 sm:px-3" data-testid="tab-notifications">Notifications</TabsTrigger>}
          </TabsList>
        </div>

        <TabsContent value="users" className="mt-4">
          <div className="flex justify-end mb-4">
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetNewUserForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2 w-full sm:w-auto" data-testid="button-add-user">
                  <Shield className="h-4 w-4" /> New User
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>Add a new user to the system</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input 
                      value={newUserName} 
                      onChange={(e) => setNewUserName(e.target.value)} 
                      required 
                      data-testid="input-user-name" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                      value={newUserEmail} 
                      onChange={(e) => setNewUserEmail(e.target.value)} 
                      type="email" 
                      required 
                      data-testid="input-user-email" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input 
                      value={newUserPassword} 
                      onChange={(e) => setNewUserPassword(e.target.value)} 
                      type="password" 
                      required 
                      data-testid="input-user-password" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    {rolesLoading ? (
                      <div className="text-sm text-muted-foreground">Loading roles...</div>
                    ) : (
                      <Select value={newUserRole} onValueChange={setNewUserRole}>
                        <SelectTrigger data-testid="select-user-role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map(role => (
                            <SelectItem key={role.id} value={role.name}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                  <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-create-user">
                    {createMutation.isPending ? 'Creating...' : 'Create User'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg">User Permissions</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              {usersLoading ? (
                <div className="text-center py-8 text-muted-foreground">Loading users...</div>
              ) : usersError ? (
                <div className="text-center py-8 text-destructive text-sm">
                  <p>Error loading users: {(usersError as any).message || 'Unknown error'}</p>
                  {(usersError as any).details && (
                    <p className="mt-1 text-xs">Details: {(usersError as any).details}</p>
                  )}
                  <p className="mt-2 text-xs text-muted-foreground">Please try refreshing the page. If the problem persists, contact support.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {users.map((user) => (
                    <div key={user.id} className="border rounded-lg overflow-hidden">
                      <div 
                        className="flex items-center justify-between p-3 sm:p-4 bg-muted/30 cursor-pointer"
                        onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-primary/10 flex items-center justify-center text-xs sm:text-sm font-medium text-primary">
                            {user.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium text-sm sm:text-base truncate">{user.name}</div>
                            <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs hidden sm:inline-flex">{getRoleLabel(user.role)}</Badge>
                          {expandedUser === user.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                      
                      {expandedUser === user.id && (
                        <div className="p-3 sm:p-4 border-t space-y-3">
                          <div className="flex items-center justify-between">
                            <Badge variant="outline">{getRoleLabel(user.role)}</Badge>
                            <div className="flex gap-2">
                              {isSuperAdmin && user.role !== 'superadmin' && (
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => openEditDialog(user)}
                                  data-testid={`button-edit-user-${user.id}`}
                                >
                                  <Pencil className="h-4 w-4 mr-1" /> Edit
                                </Button>
                              )}
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                disabled={user.role === 'admin' || user.role === 'superadmin'}
                                onClick={() => deleteMutation.mutate(user.id)}
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                <Trash2 className="h-4 w-4 mr-1" /> Delete
                              </Button>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <p className="text-xs text-muted-foreground font-medium">Page Permissions:</p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {ALL_PAGES.filter(p => p.id !== 'dashboard').map(page => (
                                <label 
                                  key={page.id} 
                                  className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer p-2 rounded hover:bg-muted/50"
                                >
                                  <Checkbox 
                                    checked={user.allowedPages?.includes(page.id)}
                                    onCheckedChange={() => togglePermission(user.id, page.id, user.allowedPages || [])}
                                    disabled={user.role === 'admin' || user.role === 'superadmin'}
                                    data-testid={`checkbox-${user.id}-${page.id}`}
                                  />
                                  <span className="truncate">{page.label}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {users.length === 0 && (
                    <p className="text-center py-8 text-muted-foreground text-sm">No users found</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isSuperAdmin && (
          <TabsContent value="employees" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  All Employees ({currentEmployees.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {employeesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading employees...</div>
                ) : currentEmployees.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No employees found. Use the Onboarding tab to add employees.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {currentEmployees.map((employee) => (
                      <div key={employee.id} className="border rounded-lg p-4 bg-muted/20">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-medium text-primary overflow-hidden flex-shrink-0">
                            {employee.photoUrl ? (
                              <img src={employee.photoUrl} alt={employee.name} className="w-full h-full object-cover" />
                            ) : (
                              employee.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold text-base">{employee.name}</h3>
                              <Badge variant="outline" className="text-xs">{employee.employeeId}</Badge>
                            </div>
                            {employee.designation && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                <Building2 className="h-3 w-3" />
                                {employee.designation} {employee.department && `• ${employee.department}`}
                              </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-sm">
                              {employee.email && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Mail className="h-3 w-3" />
                                  <span className="truncate">{employee.email}</span>
                                </div>
                              )}
                              {employee.phone && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Phone className="h-3 w-3" />
                                  {employee.phone}
                                </div>
                              )}
                              {employee.joinDate && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  Joined: {format(new Date(employee.joinDate), 'dd MMM yyyy')}
                                </div>
                              )}
                              {employee.salary && (
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <span className="font-medium">₹{parseInt(employee.salary).toLocaleString('en-IN')}/month</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="roles" className="mt-4">
            <div className="flex justify-end mb-4">
              <Dialog open={isRoleDialogOpen} onOpenChange={(open) => {
                setIsRoleDialogOpen(open);
                if (!open) resetNewRoleForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2 w-full sm:w-auto" data-testid="button-add-role">
                    <Plus className="h-4 w-4" /> New Role
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Create New Role</DialogTitle>
                    <DialogDescription>Add a custom role to the system</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateRole} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Role Name</Label>
                      <Input 
                        value={newRoleLabel}
                        onChange={(e) => setNewRoleLabel(e.target.value)}
                        required 
                        placeholder="e.g., Event Coordinator" 
                        data-testid="input-role-label" 
                      />
                      <p className="text-xs text-muted-foreground">This is the display name for the role</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input 
                        value={newRoleDescription}
                        onChange={(e) => setNewRoleDescription(e.target.value)}
                        placeholder="Brief description of the role" 
                        data-testid="input-role-description" 
                      />
                    </div>
                    <Button type="submit" className="w-full" disabled={createRoleMutation.isPending} data-testid="button-create-role">
                      {createRoleMutation.isPending ? 'Creating...' : 'Create Role'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg">Manage Roles</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                {rolesLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading roles...</div>
                ) : (
                  <div className="space-y-3">
                    {roles.map((role) => (
                      <div key={role.id} className="border rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Tag className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {role.label}
                              {role.isSystem && (
                                <Badge variant="secondary" className="text-xs">System</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {role.description || `System name: ${role.name}`}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openEditRoleDialog(role)}
                            data-testid={`button-edit-role-${role.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!role.isSystem && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteRoleMutation.mutate(role.id)}
                              data-testid={`button-delete-role-${role.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {roles.length === 0 && (
                      <p className="text-center py-8 text-muted-foreground text-sm">No roles found</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="holidays" className="mt-4">
            <div className="flex justify-end mb-4">
              <Dialog open={isHolidayDialogOpen} onOpenChange={(open) => {
                setIsHolidayDialogOpen(open);
                if (!open) resetNewHolidayForm();
              }}>
                <DialogTrigger asChild>
                  <Button className="gap-2 w-full sm:w-auto" data-testid="button-add-holiday">
                    <Plus className="h-4 w-4" /> New Holiday
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Public Holiday</DialogTitle>
                    <DialogDescription>Add a new public holiday to the calendar</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateHoliday} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Holiday Name</Label>
                      <Input 
                        value={newHolidayName}
                        onChange={(e) => setNewHolidayName(e.target.value)}
                        required 
                        placeholder="e.g., Diwali, Independence Day" 
                        data-testid="input-holiday-name" 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Date</Label>
                      <Input 
                        type="date"
                        value={newHolidayDate}
                        onChange={(e) => setNewHolidayDate(e.target.value)}
                        required 
                        data-testid="input-holiday-date" 
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox 
                        id="new-holiday-national"
                        checked={newHolidayIsNational}
                        onCheckedChange={(checked) => setNewHolidayIsNational(checked as boolean)}
                        data-testid="checkbox-holiday-national"
                      />
                      <Label htmlFor="new-holiday-national" className="text-sm">National Holiday</Label>
                    </div>
                    <Button type="submit" className="w-full" disabled={createHolidayMutation.isPending} data-testid="button-create-holiday">
                      {createHolidayMutation.isPending ? 'Creating...' : 'Add Holiday'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg">Manage Public Holidays</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                {holidaysLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading holidays...</div>
                ) : (
                  <div className="space-y-3">
                    {holidays.map((holiday) => (
                      <div key={holiday.id} className="border rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-2">
                              {holiday.name}
                              {holiday.isNational && (
                                <Badge variant="secondary" className="text-xs">National</Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(holiday.date), 'dd MMM yyyy')}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openEditHolidayDialog(holiday)}
                            data-testid={`button-edit-holiday-${holiday.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => deleteHolidayMutation.mutate(holiday.id)}
                            data-testid={`button-delete-holiday-${holiday.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {holidays.length === 0 && (
                      <p className="text-center py-8 text-muted-foreground text-sm">No public holidays configured</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="leave" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Leave Categories
                </CardTitle>
                <Dialog open={isLeaveCategoryDialogOpen} onOpenChange={(open) => {
                  setIsLeaveCategoryDialogOpen(open);
                  if (!open) resetNewLeaveCategoryForm();
                }}>
                  <DialogTrigger asChild>
                    <Button className="gap-2" data-testid="button-add-leave-category">
                      <Plus className="h-4 w-4" /> Add Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add Leave Category</DialogTitle>
                      <DialogDescription>Create a new leave category for employees</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateLeaveCategory} className="space-y-4">
                      <div className="space-y-2">
                        <Label>Category Name</Label>
                        <Input 
                          value={newCategoryName}
                          onChange={(e) => setNewCategoryName(e.target.value)}
                          placeholder="e.g., Maternity Leave"
                          required 
                          data-testid="input-category-name" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea 
                          value={newCategoryDescription}
                          onChange={(e) => setNewCategoryDescription(e.target.value)}
                          placeholder="Optional description"
                          data-testid="input-category-description" 
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Default Annual Allowance (days)</Label>
                        <Input 
                          type="number"
                          value={newCategoryAllowance}
                          onChange={(e) => setNewCategoryAllowance(parseInt(e.target.value) || 0)}
                          min={0}
                          required 
                          data-testid="input-category-allowance" 
                        />
                      </div>
                      <Button type="submit" className="w-full" disabled={createLeaveCategoryMutation.isPending} data-testid="button-create-category">
                        {createLeaveCategoryMutation.isPending ? 'Creating...' : 'Add Category'}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
                  <p className="font-medium">Leave Reset Policy</p>
                  <p className="mt-1">Leave balances automatically reset to default values on January 1st each year.</p>
                </div>
                
                {leaveCategoriesLoading ? (
                  <p>Loading leave categories...</p>
                ) : (
                  <div className="space-y-3">
                    {leaveCategories.map((category) => (
                      <div key={category.id} className="flex items-center justify-between p-3 border rounded-lg" data-testid={`leave-category-${category.id}`}>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{category.name}</span>
                            {category.isSystem && (
                              <Badge variant="secondary" className="text-xs">System</Badge>
                            )}
                          </div>
                          {category.description && (
                            <div className="text-xs text-muted-foreground mt-1">{category.description}</div>
                          )}
                          <div className="text-sm text-muted-foreground mt-1">
                            Default: {category.defaultAnnualAllowance} days/year
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => openEditLeaveCategoryDialog(category)}
                            data-testid={`button-edit-category-${category.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!category.isSystem && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => deleteLeaveCategoryMutation.mutate(category.id)}
                              data-testid={`button-delete-category-${category.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {leaveCategories.length === 0 && (
                      <p className="text-center py-8 text-muted-foreground text-sm">No leave categories configured</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="onboarding" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Employee Onboarding
                </CardTitle>
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    variant="outline"
                    className="gap-2" 
                    onClick={() => setIsLinkUserDialogOpen(true)}
                    data-testid="button-link-existing-user"
                    disabled={usersWithoutEmployee.length === 0}
                  >
                    <UserPlus className="h-4 w-4" /> Link Existing User {usersWithoutEmployee.length > 0 && `(${usersWithoutEmployee.length})`}
                  </Button>
                  <Dialog open={isEmployeeDialogOpen} onOpenChange={(open) => {
                    setIsEmployeeDialogOpen(open);
                    if (!open) resetEmployeeForm();
                  }}>
                    <DialogTrigger asChild>
                      <Button className="gap-2" data-testid="button-new-employee">
                        <Plus className="h-4 w-4" /> New Employee
                      </Button>
                    </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>{createdCredentials ? 'Employee Created Successfully' : 'Create New Employee'}</DialogTitle>
                      <DialogDescription>
                        {createdCredentials 
                          ? 'Save these credentials securely. The password is shown only once.'
                          : 'Add a new employee with auto-generated credentials'
                        }
                      </DialogDescription>
                    </DialogHeader>
                    
                    {createdCredentials ? (
                      <div className="space-y-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                          <div className="flex items-center gap-2 text-green-700 font-medium">
                            <Shield className="h-5 w-5" />
                            Employee Credentials
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center justify-between p-2 bg-white rounded border">
                              <div>
                                <div className="text-xs text-muted-foreground">Employee ID</div>
                                <div className="font-mono font-medium">{createdCredentials.employeeId}</div>
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(createdCredentials.employeeId)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="flex items-center justify-between p-2 bg-white rounded border">
                              <div>
                                <div className="text-xs text-muted-foreground">Email</div>
                                <div className="font-mono font-medium">{createdCredentials.email}</div>
                              </div>
                              <Button variant="ghost" size="sm" onClick={() => copyToClipboard(createdCredentials.email)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="flex items-center justify-between p-2 bg-white rounded border">
                              <div>
                                <div className="text-xs text-muted-foreground">Temporary Password</div>
                                <div className="font-mono font-medium">
                                  {showPassword ? createdCredentials.temporaryPassword : '••••••••••••'}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => setShowPassword(!showPassword)}>
                                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(createdCredentials.temporaryPassword)}>
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded">
                          <Checkbox 
                            id="credentials-acknowledged"
                            checked={credentialsAcknowledged}
                            onCheckedChange={(checked) => setCredentialsAcknowledged(checked as boolean)}
                            data-testid="checkbox-credentials-acknowledged"
                          />
                          <Label htmlFor="credentials-acknowledged" className="text-sm text-amber-700">
                            I have saved these credentials securely. I understand they will not be shown again.
                          </Label>
                        </div>
                        
                        <Button 
                          className="w-full" 
                          disabled={!credentialsAcknowledged}
                          onClick={() => {
                            setIsEmployeeDialogOpen(false);
                            resetEmployeeForm();
                          }}
                          data-testid="button-done"
                        >
                          Done
                        </Button>
                      </div>
                    ) : (
                      <form onSubmit={handleCreateEmployee} className="space-y-4">
                        <div className="flex justify-center py-2">
                          <PhotoUploader 
                            currentPhotoUrl={newEmployee.photoUrl} 
                            onPhotoChange={(url) => setNewEmployee({...newEmployee, photoUrl: url})}
                            name={newEmployee.name}
                          />
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Full Name *</Label>
                            <Input 
                              value={newEmployee.name}
                              onChange={(e) => setNewEmployee({...newEmployee, name: e.target.value})}
                              required
                              data-testid="input-emp-name"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Email *</Label>
                            <Input 
                              type="email"
                              value={newEmployee.email}
                              onChange={(e) => setNewEmployee({...newEmployee, email: e.target.value})}
                              required
                              data-testid="input-emp-email"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Phone</Label>
                            <Input 
                              value={newEmployee.phone}
                              onChange={(e) => setNewEmployee({...newEmployee, phone: e.target.value})}
                              data-testid="input-emp-phone"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>WhatsApp Number</Label>
                            <Input 
                              value={newEmployee.whatsappNumber}
                              onChange={(e) => setNewEmployee({...newEmployee, whatsappNumber: e.target.value})}
                              placeholder="e.g. +919876543210"
                              data-testid="input-emp-whatsapp"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Date of Birth</Label>
                            <Input 
                              type="date"
                              value={newEmployee.dateOfBirth}
                              onChange={(e) => setNewEmployee({...newEmployee, dateOfBirth: e.target.value})}
                              data-testid="input-emp-dob"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Join Date *</Label>
                            <Input 
                              type="date"
                              value={newEmployee.joinDate}
                              onChange={(e) => setNewEmployee({...newEmployee, joinDate: e.target.value})}
                              required
                              data-testid="input-emp-joindate"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Designation *</Label>
                            <Input 
                              value={newEmployee.designation}
                              onChange={(e) => setNewEmployee({...newEmployee, designation: e.target.value})}
                              required
                              placeholder="e.g. Software Engineer"
                              data-testid="input-emp-designation"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Department</Label>
                            <Input 
                              value={newEmployee.department}
                              onChange={(e) => setNewEmployee({...newEmployee, department: e.target.value})}
                              placeholder="e.g. Engineering"
                              data-testid="input-emp-department"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Monthly Salary (INR) *</Label>
                            <Input 
                              type="number"
                              value={newEmployee.salary}
                              onChange={(e) => setNewEmployee({...newEmployee, salary: e.target.value})}
                              required
                              placeholder="50000"
                              data-testid="input-emp-salary"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Annual Leave Days</Label>
                            <Input 
                              type="number"
                              value={newEmployee.totalLeavesPerYear}
                              onChange={(e) => setNewEmployee({...newEmployee, totalLeavesPerYear: parseInt(e.target.value) || 24})}
                              data-testid="input-emp-leaves"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Address *</Label>
                          <Textarea 
                            value={newEmployee.address}
                            onChange={(e) => setNewEmployee({...newEmployee, address: e.target.value})}
                            required
                            rows={2}
                            data-testid="input-emp-address"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Emergency Contact *</Label>
                          <Input 
                            value={newEmployee.emergencyContact}
                            onChange={(e) => setNewEmployee({...newEmployee, emergencyContact: e.target.value})}
                            required
                            placeholder="Name - Phone Number"
                            data-testid="input-emp-emergency"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Assign Manager</Label>
                          <Select 
                            value={newEmployee.managerUserId} 
                            onValueChange={(value) => setNewEmployee({...newEmployee, managerUserId: value})}
                          >
                            <SelectTrigger data-testid="select-emp-manager">
                              <SelectValue placeholder="Select a manager (optional)" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No Manager</SelectItem>
                              {managers.map(manager => (
                                <SelectItem key={manager.id} value={manager.id}>
                                  {manager.name} ({manager.role})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Bank Account Number</Label>
                            <Input 
                              value={newEmployee.bankAccountNumber}
                              onChange={(e) => setNewEmployee({...newEmployee, bankAccountNumber: e.target.value})}
                              data-testid="input-emp-bank"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>IFSC Code</Label>
                            <Input 
                              value={newEmployee.bankIfscCode}
                              onChange={(e) => setNewEmployee({...newEmployee, bankIfscCode: e.target.value})}
                              data-testid="input-emp-ifsc"
                            />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>PAN Number</Label>
                            <Input 
                              value={newEmployee.panNumber}
                              onChange={(e) => setNewEmployee({...newEmployee, panNumber: e.target.value})}
                              data-testid="input-emp-pan"
                            />
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Duties</Label>
                          <Textarea 
                            value={newEmployee.duties}
                            onChange={(e) => setNewEmployee({...newEmployee, duties: e.target.value})}
                            rows={2}
                            placeholder="List key duties..."
                            data-testid="input-emp-duties"
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Responsibilities</Label>
                          <Textarea 
                            value={newEmployee.responsibilities}
                            onChange={(e) => setNewEmployee({...newEmployee, responsibilities: e.target.value})}
                            rows={2}
                            placeholder="List key responsibilities..."
                            data-testid="input-emp-responsibilities"
                          />
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
                            <Shield className="h-4 w-4" />
                            A secure password will be auto-generated on the server
                          </div>
                          <p className="text-xs text-blue-600 mt-1">
                            Credentials will be shown only once after creation. Make sure to save them securely.
                          </p>
                        </div>
                        
                        <Button 
                          type="submit" 
                          className="w-full" 
                          disabled={createEmployeeMutation.isPending}
                          data-testid="button-create-employee"
                        >
                          {createEmployeeMutation.isPending ? 'Creating...' : 'Create Employee'}
                        </Button>
                      </form>
                    )}
                  </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Use this section to onboard new employees. Each employee gets an auto-generated unique ID 
                  (format: OAK-YYYY-XXXX) and secure login credentials. Credentials are shown only once upon creation.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="calendar" className="mt-4">
            <CalendarIntegrationTab />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="messaging" className="mt-4">
            <MessagingTab />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="templates" className="mt-4">
            <ChecklistTemplatesTab />
          </TabsContent>
        )}

        {isSuperAdmin && (
          <TabsContent value="notifications" className="mt-4">
            <NotificationsTab />
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={isLinkUserDialogOpen} onOpenChange={(open) => {
        setIsLinkUserDialogOpen(open);
        if (!open) resetLinkEmployeeForm();
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Link Existing User to Employee Record</DialogTitle>
            <DialogDescription>
              Create an employee profile for an existing user who doesn't have one yet.
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={(e) => {
            e.preventDefault();
            if (!selectedUserId) return;
            linkUserToEmployeeMutation.mutate({
              userId: selectedUserId,
              phone: linkEmployeeData.phone,
              dateOfBirth: linkEmployeeData.dateOfBirth || null,
              photoUrl: linkEmployeeData.photoUrl,
              joinDate: linkEmployeeData.joinDate,
              designation: linkEmployeeData.designation,
              department: linkEmployeeData.department,
              salary: linkEmployeeData.salary,
              address: linkEmployeeData.address,
              emergencyContact: linkEmployeeData.emergencyContact,
              managerUserId: linkEmployeeData.managerUserId || null,
              bankAccountNumber: linkEmployeeData.bankAccountNumber,
              bankIfscCode: linkEmployeeData.bankIfscCode,
              panNumber: linkEmployeeData.panNumber,
              duties: linkEmployeeData.duties,
              responsibilities: linkEmployeeData.responsibilities,
              totalLeavesPerYear: linkEmployeeData.totalLeavesPerYear,
            });
          }} className="space-y-4">
            <div className="space-y-2">
              <Label>Select User *</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger data-testid="select-link-user">
                  <SelectValue placeholder="Choose a user to link" />
                </SelectTrigger>
                <SelectContent>
                  {usersWithoutEmployee.map(u => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name} ({u.email}) - {u.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Phone *</Label>
                <Input 
                  value={linkEmployeeData.phone}
                  onChange={(e) => setLinkEmployeeData({...linkEmployeeData, phone: e.target.value})}
                  required
                  data-testid="input-link-phone"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input 
                  type="date"
                  value={linkEmployeeData.dateOfBirth}
                  onChange={(e) => setLinkEmployeeData({...linkEmployeeData, dateOfBirth: e.target.value})}
                  data-testid="input-link-dob"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Join Date *</Label>
                <Input 
                  type="date"
                  value={linkEmployeeData.joinDate}
                  onChange={(e) => setLinkEmployeeData({...linkEmployeeData, joinDate: e.target.value})}
                  required
                  data-testid="input-link-joindate"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Designation *</Label>
                <Input 
                  value={linkEmployeeData.designation}
                  onChange={(e) => setLinkEmployeeData({...linkEmployeeData, designation: e.target.value})}
                  required
                  placeholder="e.g. Wedding Planner"
                  data-testid="input-link-designation"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Department</Label>
                <Input 
                  value={linkEmployeeData.department}
                  onChange={(e) => setLinkEmployeeData({...linkEmployeeData, department: e.target.value})}
                  data-testid="input-link-department"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Monthly Salary (INR) *</Label>
                <Input 
                  type="number"
                  value={linkEmployeeData.salary}
                  onChange={(e) => setLinkEmployeeData({...linkEmployeeData, salary: e.target.value})}
                  required
                  data-testid="input-link-salary"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Address *</Label>
              <Textarea 
                value={linkEmployeeData.address}
                onChange={(e) => setLinkEmployeeData({...linkEmployeeData, address: e.target.value})}
                required
                rows={2}
                data-testid="input-link-address"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Emergency Contact *</Label>
              <Input 
                value={linkEmployeeData.emergencyContact}
                onChange={(e) => setLinkEmployeeData({...linkEmployeeData, emergencyContact: e.target.value})}
                required
                placeholder="Name - Phone Number"
                data-testid="input-link-emergency"
              />
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-700">
                The user will automatically get access to the Employee Portal after linking.
              </p>
            </div>
            
            <Button 
              type="submit" 
              className="w-full" 
              disabled={linkUserToEmployeeMutation.isPending || !selectedUserId}
              data-testid="button-link-employee"
            >
              {linkUserToEmployeeMutation.isPending ? 'Creating Employee Record...' : 'Create Employee Record'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditHolidayDialogOpen} onOpenChange={setIsEditHolidayDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Holiday</DialogTitle>
            <DialogDescription>Update holiday details</DialogDescription>
          </DialogHeader>
          {editingHoliday && (
            <form onSubmit={handleUpdateHoliday} className="space-y-4">
              <div className="space-y-2">
                <Label>Holiday Name</Label>
                <Input 
                  value={editHolidayName}
                  onChange={(e) => setEditHolidayName(e.target.value)}
                  required 
                  data-testid="input-edit-holiday-name" 
                />
              </div>
              <div className="space-y-2">
                <Label>Date</Label>
                <Input 
                  type="date"
                  value={editHolidayDate}
                  onChange={(e) => setEditHolidayDate(e.target.value)}
                  required 
                  data-testid="input-edit-holiday-date" 
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="edit-holiday-national"
                  checked={editHolidayIsNational}
                  onCheckedChange={(checked) => setEditHolidayIsNational(checked as boolean)}
                  data-testid="checkbox-edit-holiday-national"
                />
                <Label htmlFor="edit-holiday-national" className="text-sm">National Holiday</Label>
              </div>
              <Button type="submit" className="w-full" disabled={updateHolidayMutation.isPending} data-testid="button-save-holiday">
                {updateHolidayMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditLeaveCategoryDialogOpen} onOpenChange={setIsEditLeaveCategoryDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Leave Category</DialogTitle>
            <DialogDescription>
              {editingLeaveCategory?.isSystem 
                ? 'Update default allowance for this system category'
                : 'Update leave category details'
              }
            </DialogDescription>
          </DialogHeader>
          {editingLeaveCategory && (
            <form onSubmit={handleUpdateLeaveCategory} className="space-y-4">
              <div className="space-y-2">
                <Label>Category Name</Label>
                <Input 
                  value={editCategoryName}
                  onChange={(e) => setEditCategoryName(e.target.value)}
                  disabled={editingLeaveCategory.isSystem}
                  className={editingLeaveCategory.isSystem ? "bg-muted" : ""}
                  required 
                  data-testid="input-edit-category-name" 
                />
                {editingLeaveCategory.isSystem && (
                  <p className="text-xs text-muted-foreground">System categories cannot be renamed</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea 
                  value={editCategoryDescription}
                  onChange={(e) => setEditCategoryDescription(e.target.value)}
                  disabled={editingLeaveCategory.isSystem}
                  className={editingLeaveCategory.isSystem ? "bg-muted" : ""}
                  data-testid="input-edit-category-description" 
                />
              </div>
              <div className="space-y-2">
                <Label>Default Annual Allowance (days)</Label>
                <Input 
                  type="number"
                  value={editCategoryAllowance}
                  onChange={(e) => setEditCategoryAllowance(parseInt(e.target.value) || 0)}
                  min={0}
                  required 
                  data-testid="input-edit-category-allowance" 
                />
              </div>
              <Button type="submit" className="w-full" disabled={updateLeaveCategoryMutation.isPending} data-testid="button-save-category">
                {updateLeaveCategoryMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Change user role</DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={editingUser.name} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={editingUser.email} disabled className="bg-muted" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={editRole} onValueChange={setEditRole}>
                  <SelectTrigger data-testid="select-edit-role">
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.filter(r => r.name !== 'superadmin').map(role => (
                      <SelectItem key={role.id} value={role.name}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                className="w-full" 
                onClick={handleUpdateUser}
                disabled={updateUserMutation.isPending}
                data-testid="button-save-user"
              >
                {updateUserMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditRoleDialogOpen} onOpenChange={setIsEditRoleDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Role</DialogTitle>
            <DialogDescription>Update role details</DialogDescription>
          </DialogHeader>
          {editingRole && (
            <form onSubmit={handleUpdateRole} className="space-y-4">
              <div className="space-y-2">
                <Label>System Name</Label>
                <Input value={editingRole.name} disabled className="bg-muted" />
                <p className="text-xs text-muted-foreground">System name cannot be changed</p>
              </div>
              <div className="space-y-2">
                <Label>Display Name</Label>
                <Input 
                  value={editRoleLabel}
                  onChange={(e) => setEditRoleLabel(e.target.value)}
                  required 
                  data-testid="input-edit-role-label" 
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input 
                  value={editRoleDescription}
                  onChange={(e) => setEditRoleDescription(e.target.value)}
                  data-testid="input-edit-role-description" 
                />
              </div>
              <Button type="submit" className="w-full" disabled={updateRoleMutation.isPending} data-testid="button-save-role">
                {updateRoleMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

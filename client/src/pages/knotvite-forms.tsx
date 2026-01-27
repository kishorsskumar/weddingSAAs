import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Plus, Trash2, Edit, Copy, ExternalLink, GripVertical, Settings2, FileText, Users, Eye, MoreVertical } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface RsvpFormTemplate {
  id: string;
  companyId: string;
  eventId?: string | null;
  name: string;
  status: string;
  welcomeMessage?: string | null;
  confirmationMessage?: string | null;
  deadline?: string | null;
  requireEmail: boolean;
  requirePhone: boolean;
  brandingEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RsvpFormField {
  id: string;
  templateId: string;
  fieldKey: string;
  fieldType: string;
  label: string;
  placeholder?: string | null;
  defaultValue?: string | null;
  required: boolean;
  options?: { value: string; label: string }[] | null;
  order: number;
  isSystemField: boolean;
}

interface Event {
  id: string;
  name: string;
  date: string;
}

const FIELD_TYPES = [
  { value: 'text', label: 'Text Input' },
  { value: 'textarea', label: 'Multi-line Text' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'toggle', label: 'Yes/No Toggle' },
  { value: 'multiselect', label: 'Multi-select' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date Picker' },
];

export default function KnotViteForms() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RsvpFormTemplate | null>(null);
  const [showFieldEditor, setShowFieldEditor] = useState<string | null>(null);
  const [newField, setNewField] = useState({ type: 'text', label: '', placeholder: '', required: false, options: '' });
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const { data: templates = [] } = useQuery<RsvpFormTemplate[]>({
    queryKey: ['/api/rsvp/templates'],
    queryFn: async () => {
      const res = await fetch('/api/rsvp/templates', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await fetch('/api/events', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch events');
      return res.json();
    },
  });

  const { data: fields = [] } = useQuery<RsvpFormField[]>({
    queryKey: ['/api/rsvp/templates', showFieldEditor, 'fields'],
    queryFn: async () => {
      if (!showFieldEditor) return [];
      const res = await fetch(`/api/rsvp/templates/${showFieldEditor}/fields`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch fields');
      return res.json();
    },
    enabled: !!showFieldEditor,
  });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: Partial<RsvpFormTemplate>) => {
      const res = await fetch('/api/rsvp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to create template');
      return res.json();
    },
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp/templates'] });
      setIsCreateOpen(false);
      toast({ title: "Success", description: "Form template created" });
      setShowFieldEditor(template.id);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create template", variant: "destructive" });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RsvpFormTemplate> }) => {
      const res = await fetch(`/api/rsvp/templates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp/templates'] });
      setEditingTemplate(null);
      toast({ title: "Success", description: "Template updated" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/rsvp/templates/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp/templates'] });
      toast({ title: "Success", description: "Template deleted" });
    },
  });

  const createFieldMutation = useMutation({
    mutationFn: async ({ templateId, data }: { templateId: string; data: Partial<RsvpFormField> }) => {
      const res = await fetch(`/api/rsvp/templates/${templateId}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          order: fields.length,
        }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to create field');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp/templates', showFieldEditor, 'fields'] });
      setNewField({ type: 'text', label: '', placeholder: '', required: false, options: '' });
      toast({ title: "Success", description: "Field added" });
    },
  });

  const deleteFieldMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/rsvp/fields/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete field');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp/templates', showFieldEditor, 'fields'] });
      toast({ title: "Success", description: "Field removed" });
    },
  });

  const filteredTemplates = useMemo(() => {
    return templates.filter(t =>
      t.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [templates, searchTerm]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);
  };

  const handleCreateTemplate = (formData: FormData) => {
    const name = formData.get('name') as string;
    const eventId = formData.get('eventId') as string;
    const welcomeMessage = formData.get('description') as string;
    
    createTemplateMutation.mutate({
      name,
      eventId: eventId === 'none' ? null : (eventId || null),
      welcomeMessage: welcomeMessage || null,
      status: 'draft',
    });
  };

  const selectedTemplate = templates.find(t => t.id === showFieldEditor);

  if (showFieldEditor && selectedTemplate) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div>
            <Button variant="ghost" className="mb-2" onClick={() => setShowFieldEditor(null)} data-testid="back-to-templates">
              ← Back to Forms
            </Button>
            <h1 className="text-2xl font-semibold" data-testid="form-builder-title">{selectedTemplate.name}</h1>
            <p className="text-muted-foreground text-sm">Add and manage form fields</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={selectedTemplate.status === 'published' ? "default" : "secondary"}>
              {selectedTemplate.status === 'published' ? "Published" : "Draft"}
            </Badge>
            <Button 
              variant={selectedTemplate.status === 'published' ? "outline" : "default"}
              onClick={() => updateTemplateMutation.mutate({
                id: selectedTemplate.id,
                data: { status: selectedTemplate.status === 'published' ? 'draft' : 'published' }
              })}
              data-testid="toggle-publish-btn"
            >
              {selectedTemplate.status === 'published' ? "Unpublish" : "Publish Form"}
            </Button>
            {selectedTemplate.status === 'published' && (
              <Button variant="outline" asChild data-testid="preview-form-btn">
                <a href={`/rsvp/${selectedTemplate.id}`} target="_blank" rel="noopener noreferrer">
                  <Eye className="h-4 w-4 mr-2" />
                  Preview
                </a>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Form Fields</CardTitle>
                <CardDescription>Add and arrange the fields guests will fill out</CardDescription>
              </CardHeader>
              <CardContent>
                {fields.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground" data-testid="no-fields-message">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
                    <p>No fields yet. Add fields using the panel on the right.</p>
                  </div>
                ) : (
                  <div className="space-y-3" data-testid="fields-list">
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border"
                        data-testid={`field-item-${index}`}
                      >
                        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{field.label}</span>
                            {field.required && <Badge variant="outline" className="text-xs">Required</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {FIELD_TYPES.find(t => t.value === field.fieldType)?.label || field.fieldType}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteFieldMutation.mutate(field.id)}
                          data-testid={`delete-field-${index}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div>
            <Card>
              <CardHeader>
                <CardTitle>Add Field</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Field Type</Label>
                  <Select value={newField.type} onValueChange={(v) => setNewField({ ...newField, type: v })}>
                    <SelectTrigger data-testid="field-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FIELD_TYPES.map(type => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Label</Label>
                  <Input
                    value={newField.label}
                    onChange={(e) => setNewField({ ...newField, label: e.target.value })}
                    placeholder="e.g., Guest Name"
                    data-testid="field-label-input"
                  />
                </div>
                <div>
                  <Label>Placeholder (optional)</Label>
                  <Input
                    value={newField.placeholder}
                    onChange={(e) => setNewField({ ...newField, placeholder: e.target.value })}
                    placeholder="e.g., Enter your name"
                    data-testid="field-placeholder-input"
                  />
                </div>
                {['dropdown', 'multiselect'].includes(newField.type) && (
                  <div>
                    <Label>Options (comma-separated)</Label>
                    <Input
                      value={newField.options}
                      onChange={(e) => setNewField({ ...newField, options: e.target.value })}
                      placeholder="Yes, No, Maybe"
                      data-testid="field-options-input"
                    />
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <Label>Required Field</Label>
                  <Switch
                    checked={newField.required}
                    onCheckedChange={(v) => setNewField({ ...newField, required: v })}
                    data-testid="field-required-switch"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    if (!newField.label.trim()) return;
                    createFieldMutation.mutate({
                      templateId: showFieldEditor,
                      data: {
                        fieldKey: newField.label.toLowerCase().replace(/\s+/g, '_'),
                        fieldType: newField.type,
                        label: newField.label,
                        placeholder: newField.placeholder || null,
                        required: newField.required,
                        options: newField.options ? newField.options.split(',').map(o => ({ value: o.trim().toLowerCase(), label: o.trim() })) : null,
                      },
                    });
                  }}
                  disabled={!newField.label.trim()}
                  data-testid="add-field-btn"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Field
                </Button>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-base">Form Link</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={`${window.location.origin}/rsvp/${selectedTemplate.id}`}
                    className="text-xs"
                    data-testid="form-link-input"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/rsvp/${selectedTemplate.id}`);
                      toast({ title: "Copied!", description: "Link copied to clipboard" });
                    }}
                    data-testid="copy-link-btn"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="knotvite-forms-title">RSVP Forms</h1>
          <p className="text-muted-foreground text-sm">Create and manage RSVP forms for your events</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-form-btn">
              <Plus className="h-4 w-4 mr-2" />
              New Form
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create RSVP Form</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateTemplate(new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="name">Form Name</Label>
                <Input id="name" name="name" required placeholder="e.g., Wedding RSVP" data-testid="form-name-input" />
              </div>
              <div>
                <Label htmlFor="eventId">Link to Event (optional)</Label>
                <Select name="eventId">
                  <SelectTrigger data-testid="event-select">
                    <SelectValue placeholder="Select an event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No event</SelectItem>
                    {events.map(event => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name} - {format(new Date(event.date), 'MMM d, yyyy')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea id="description" name="description" placeholder="Brief description of this form" data-testid="form-description-input" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
                <Button type="submit" data-testid="submit-create-form">Create Form</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search forms..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
            data-testid="search-forms-input"
          />
        </div>
      </div>

      {filteredTemplates.length === 0 ? (
        <Card className="flex-1">
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <FileText className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium mb-2" data-testid="no-forms-title">No forms yet</h3>
            <p className="text-muted-foreground text-sm mb-4">Create your first RSVP form to start collecting responses</p>
            <Button onClick={() => setIsCreateOpen(true)} data-testid="empty-state-create-btn">
              <Plus className="h-4 w-4 mr-2" />
              Create Form
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="forms-grid">
          {filteredTemplates.map((template, index) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow" data-testid={`form-card-${index}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base truncate">{template.name}</CardTitle>
                    <CardDescription className="text-xs">
                      Created {format(new Date(template.createdAt), 'MMM d, yyyy')}
                    </CardDescription>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" data-testid={`form-menu-${index}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowFieldEditor(template.id)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Fields
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setEditingTemplate(template)}>
                        <Settings2 className="h-4 w-4 mr-2" />
                        Settings
                      </DropdownMenuItem>
                      {template.status === 'published' && (
                        <DropdownMenuItem asChild>
                          <a href={`/rsvp/${template.id}`} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Preview
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => {
                          if (confirm('Delete this form?')) {
                            deleteTemplateMutation.mutate(template.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <Badge variant={template.status === 'published' ? "default" : "secondary"} className="text-xs">
                    {template.status === 'published' ? "Published" : "Draft"}
                  </Badge>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setShowFieldEditor(template.id)}
                  data-testid={`edit-form-${index}`}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit Form
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Form Settings</DialogTitle>
          </DialogHeader>
          {editingTemplate && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                updateTemplateMutation.mutate({
                  id: editingTemplate.id,
                  data: {
                    name: formData.get('name') as string,
                    description: formData.get('description') as string || null,
                    eventId: (formData.get('eventId') as string) === 'none' ? null : (formData.get('eventId') as string || null),
                  },
                });
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="edit-name">Form Name</Label>
                <Input id="edit-name" name="name" defaultValue={editingTemplate.name} required data-testid="edit-form-name" />
              </div>
              <div>
                <Label htmlFor="edit-eventId">Link to Event</Label>
                <Select name="eventId" defaultValue={editingTemplate.eventId || 'none'}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No event</SelectItem>
                    {events.map(event => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Textarea id="edit-description" name="description" defaultValue={editingTemplate.description || ''} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingTemplate(null)}>Cancel</Button>
                <Button type="submit" data-testid="save-settings-btn">Save Changes</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

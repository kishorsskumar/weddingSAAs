import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Plus, Send, Users, Trash2, Eye, CheckCircle2, XCircle, Clock, Loader2, Search } from "lucide-react";
import { format } from "date-fns";

type WhatsappTemplate = {
  id: string;
  name: string;
  body: string;
  variables: string[] | null;
  category: string | null;
  isActive: boolean;
  createdBy: string | null;
  createdAt: string | null;
};

type WhatsappJob = {
  id: string;
  templateId: string | null;
  customMessage: string | null;
  targetMode: string;
  targetEmployeeIds: string[] | null;
  targetDepartments: string[] | null;
  status: string;
  totalRecipients: number | null;
  successCount: number | null;
  failureCount: number | null;
  createdAt: string | null;
  processedAt: string | null;
};

type Employee = {
  id: string;
  name: string;
  phone: string | null;
  whatsappNumber: string | null;
  department: string | null;
  whatsappOptIn: boolean;
};

export function MessagingTab() {
  const queryClient = useQueryClient();
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false);
  const [isComposeDialogOpen, setIsComposeDialogOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const [templateName, setTemplateName] = useState('');
  const [templateBody, setTemplateBody] = useState('');
  const [templateCategory, setTemplateCategory] = useState('notification');

  const [composeMode, setComposeMode] = useState<'template' | 'custom'>('custom');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [customMessage, setCustomMessage] = useState('');
  const [targetMode, setTargetMode] = useState<'selected' | 'department' | 'all'>('selected');
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [departmentSearch, setDepartmentSearch] = useState('');

  const { data: status } = useQuery<{ configured: boolean; fromNumber: string }>({
    queryKey: ['/api/whatsapp/status'],
  });

  const { data: templates = [] } = useQuery<WhatsappTemplate[]>({
    queryKey: ['/api/whatsapp/templates'],
  });

  const { data: jobs = [] } = useQuery<WhatsappJob[]>({
    queryKey: ['/api/whatsapp/jobs'],
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['/api/whatsapp/employees'],
  });

  const optedInEmployees = employees;
  const departments = Array.from(new Set(employees.map(e => e.department).filter(Boolean))) as string[];

  const filteredEmployees = optedInEmployees.filter(emp => 
    emp.name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    (emp.department || '').toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const filteredDepartments = departments.filter(dept =>
    dept.toLowerCase().includes(departmentSearch.toLowerCase())
  );

  const departmentCounts = departments.reduce((acc, dept) => {
    acc[dept] = optedInEmployees.filter(e => e.department === dept).length;
    return acc;
  }, {} as Record<string, number>);

  const createTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; body: string; category: string }) => {
      const res = await fetch('/api/whatsapp/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/templates'] });
      setIsTemplateDialogOpen(false);
      setTemplateName('');
      setTemplateBody('');
      setTemplateCategory('notification');
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/whatsapp/templates/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete template');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/templates'] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (data: {
      templateId?: string;
      customMessage?: string;
      targetMode: string;
      targetEmployeeIds?: string[];
      targetDepartments?: string[];
    }) => {
      const res = await fetch('/api/whatsapp/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/whatsapp/jobs'] });
      setIsComposeDialogOpen(false);
      resetComposeForm();
    },
  });

  const resetComposeForm = () => {
    setComposeMode('custom');
    setSelectedTemplateId('');
    setCustomMessage('');
    setTargetMode('selected');
    setSelectedEmployees([]);
    setSelectedDepartments([]);
    setEmployeeSearch('');
    setDepartmentSearch('');
  };

  const handleSendMessage = () => {
    const data: any = { targetMode };
    if (composeMode === 'template' && selectedTemplateId) {
      data.templateId = selectedTemplateId;
    } else {
      data.customMessage = customMessage;
    }
    if (targetMode === 'selected') {
      data.targetEmployeeIds = selectedEmployees;
    } else if (targetMode === 'department') {
      data.targetDepartments = selectedDepartments;
    }
    sendMessageMutation.mutate(data);
  };

  const getStatusBadge = (jobStatus: string) => {
    switch (jobStatus) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'failed':
        return <Badge className="bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'processing':
        return <Badge className="bg-blue-100 text-blue-800"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processing</Badge>;
      default:
        return <Badge className="bg-yellow-100 text-yellow-800"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  if (!status?.configured) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            WhatsApp Messaging
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Clock className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <Badge className="mb-3 bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
              <Clock className="h-3 w-3 mr-1" />
              Integration Pending
            </Badge>
            <h3 className="text-lg font-medium mb-2">WhatsApp Integration Pending</h3>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              WhatsApp messaging is not yet set up. Once configured, you'll be able to send bulk messages to employees directly through WhatsApp.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                WhatsApp Messaging
              </CardTitle>
              <CardDescription>
                Send messages to employees via WhatsApp. From: {status.fromNumber}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-new-template">
                    <Plus className="h-4 w-4 mr-1" /> Template
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Message Template</DialogTitle>
                    <DialogDescription>Create a reusable message template</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Template Name</Label>
                      <Input
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        placeholder="e.g., Event Reminder"
                        data-testid="input-template-name"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={templateCategory} onValueChange={setTemplateCategory}>
                        <SelectTrigger data-testid="select-template-category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="reminder">Reminder</SelectItem>
                          <SelectItem value="notification">Notification</SelectItem>
                          <SelectItem value="announcement">Announcement</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Message Body</Label>
                      <Textarea
                        value={templateBody}
                        onChange={(e) => setTemplateBody(e.target.value)}
                        placeholder="Hi {{employee_name}}, this is a reminder..."
                        rows={4}
                        data-testid="input-template-body"
                      />
                      <p className="text-xs text-muted-foreground">
                        Use {"{{employee_name}}"}, {"{{department}}"}, {"{{designation}}"} for personalization
                      </p>
                    </div>
                    <Button
                      onClick={() => createTemplateMutation.mutate({ name: templateName, body: templateBody, category: templateCategory })}
                      disabled={!templateName || !templateBody || createTemplateMutation.isPending}
                      className="w-full"
                      data-testid="button-create-template"
                    >
                      {createTemplateMutation.isPending ? 'Creating...' : 'Create Template'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={isComposeDialogOpen} onOpenChange={(open) => {
                setIsComposeDialogOpen(open);
                if (!open) resetComposeForm();
              }}>
                <DialogTrigger asChild>
                  <Button size="sm" data-testid="button-compose-message">
                    <Send className="h-4 w-4 mr-1" /> Compose
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Compose WhatsApp Message</DialogTitle>
                    <DialogDescription>Send a message to selected employees</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Message Type</Label>
                      <Select value={composeMode} onValueChange={(v) => setComposeMode(v as 'template' | 'custom')}>
                        <SelectTrigger data-testid="select-compose-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="custom">Custom Message</SelectItem>
                          <SelectItem value="template">Use Template</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {composeMode === 'template' ? (
                      <div className="space-y-2">
                        <Label>Select Template</Label>
                        <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                          <SelectTrigger data-testid="select-template">
                            <SelectValue placeholder="Choose a template" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates.filter(t => t.isActive).map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {selectedTemplateId && (
                          <div className="p-3 bg-muted rounded-md text-sm">
                            {templates.find(t => t.id === selectedTemplateId)?.body}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Label>Message</Label>
                        <Textarea
                          value={customMessage}
                          onChange={(e) => setCustomMessage(e.target.value)}
                          placeholder="Type your message here..."
                          rows={4}
                          data-testid="input-custom-message"
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Recipients</Label>
                      <Select value={targetMode} onValueChange={(v) => setTargetMode(v as any)}>
                        <SelectTrigger data-testid="select-target-mode">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="selected">Select Employees</SelectItem>
                          <SelectItem value="department">By Department</SelectItem>
                          <SelectItem value="all">All Opted-In Employees</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {targetMode === 'selected' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Select Employees ({selectedEmployees.length} of {optedInEmployees.length} selected)</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedEmployees(filteredEmployees.map(e => e.id))}
                              data-testid="button-select-all-employees"
                            >
                              Select All
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedEmployees([])}
                              data-testid="button-clear-employees"
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by name or department..."
                            value={employeeSearch}
                            onChange={(e) => setEmployeeSearch(e.target.value)}
                            className="pl-9"
                            data-testid="input-employee-search"
                          />
                        </div>
                        <div className="max-h-56 overflow-y-auto border rounded-md p-2 space-y-1">
                          {filteredEmployees.map(emp => (
                            <div key={emp.id} className="flex items-center gap-2 p-1.5 hover:bg-muted rounded">
                              <Checkbox
                                id={`emp-${emp.id}`}
                                checked={selectedEmployees.includes(emp.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedEmployees([...selectedEmployees, emp.id]);
                                  } else {
                                    setSelectedEmployees(selectedEmployees.filter(id => id !== emp.id));
                                  }
                                }}
                                data-testid={`checkbox-employee-${emp.id}`}
                              />
                              <label htmlFor={`emp-${emp.id}`} className="text-sm cursor-pointer flex-1 flex items-center justify-between">
                                <span>{emp.name}</span>
                                <Badge variant="secondary" className="text-xs">{emp.department || 'No dept'}</Badge>
                              </label>
                            </div>
                          ))}
                          {filteredEmployees.length === 0 && employeeSearch && (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              No employees match "{employeeSearch}"
                            </p>
                          )}
                          {optedInEmployees.length === 0 && (
                            <p className="text-sm text-muted-foreground text-center py-2">
                              No employees with WhatsApp opt-in
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {targetMode === 'department' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label>Select Departments ({selectedDepartments.length} selected)</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedDepartments([...departments])}
                              data-testid="button-select-all-departments"
                            >
                              Select All
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setSelectedDepartments([])}
                              data-testid="button-clear-departments"
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search departments..."
                            value={departmentSearch}
                            onChange={(e) => setDepartmentSearch(e.target.value)}
                            className="pl-9"
                            data-testid="input-department-search"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {filteredDepartments.map(dept => (
                            <Button
                              key={dept}
                              type="button"
                              variant={selectedDepartments.includes(dept!) ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => {
                                if (selectedDepartments.includes(dept!)) {
                                  setSelectedDepartments(selectedDepartments.filter(d => d !== dept));
                                } else {
                                  setSelectedDepartments([...selectedDepartments, dept!]);
                                }
                              }}
                              data-testid={`button-department-${dept}`}
                              className="flex items-center gap-1.5"
                            >
                              {dept}
                              <Badge variant="secondary" className="ml-1 text-xs h-5 px-1.5">
                                {departmentCounts[dept] || 0}
                              </Badge>
                            </Button>
                          ))}
                          {filteredDepartments.length === 0 && departmentSearch && (
                            <p className="text-sm text-muted-foreground">No departments match "{departmentSearch}"</p>
                          )}
                        </div>
                      </div>
                    )}

                    {targetMode === 'all' && (
                      <p className="text-sm text-muted-foreground">
                        Message will be sent to all {optedInEmployees.length} employees who have opted in
                      </p>
                    )}

                    <Button
                      onClick={handleSendMessage}
                      disabled={
                        sendMessageMutation.isPending ||
                        (composeMode === 'template' && !selectedTemplateId) ||
                        (composeMode === 'custom' && !customMessage) ||
                        (targetMode === 'selected' && selectedEmployees.length === 0) ||
                        (targetMode === 'department' && selectedDepartments.length === 0)
                      }
                      className="w-full"
                      data-testid="button-send-message"
                    >
                      {sendMessageMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          Send Message
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="font-medium mb-3">Message Templates</h3>
            {templates.length === 0 ? (
              <p className="text-sm text-muted-foreground">No templates created yet</p>
            ) : (
              <div className="grid gap-3">
                {templates.map(template => (
                  <div key={template.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{template.name}</span>
                        <Badge variant="secondary">{template.category}</Badge>
                        {!template.isActive && <Badge variant="destructive">Inactive</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{template.body}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm('Delete this template?')) {
                          deleteTemplateMutation.mutate(template.id);
                        }
                      }}
                      data-testid={`button-delete-template-${template.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-medium mb-3">Message History</h3>
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages sent yet</p>
            ) : (
              <div className="space-y-3">
                {jobs.slice(0, 10).map(job => (
                  <div key={job.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusBadge(job.status)}
                        <span className="text-sm text-muted-foreground">
                          {job.createdAt ? format(new Date(job.createdAt), 'MMM d, yyyy h:mm a') : ''}
                        </span>
                      </div>
                      <p className="text-sm">
                        {job.targetMode === 'all' ? 'All employees' : 
                         job.targetMode === 'department' ? `Departments: ${job.targetDepartments?.join(', ')}` :
                         `${job.targetEmployeeIds?.length || 0} employees`}
                      </p>
                      {job.status === 'completed' && (
                        <p className="text-xs text-muted-foreground">
                          Delivered: {job.successCount}/{job.totalRecipients}
                          {(job.failureCount ?? 0) > 0 && <span className="text-destructive"> ({job.failureCount} failed)</span>}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-medium mb-3">Opted-In Employees</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{optedInEmployees.length} employees have opted in to receive WhatsApp messages</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

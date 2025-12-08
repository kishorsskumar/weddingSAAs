import { useState, useEffect } from "react";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Shield, Trash2, ChevronDown, ChevronUp, Pencil, Plus, Tag, Calendar, UserPlus, Copy, Eye, EyeOff } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { format } from "date-fns";

type PublicHoliday = {
  id: string;
  name: string;
  date: string;
  year: number;
  isNational: boolean;
  createdBy: string | null;
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
  { id: "hr", label: "HR" },
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

  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [credentialsAcknowledged, setCredentialsAcknowledged] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState<{ employeeId: string; email: string; temporaryPassword: string } | null>(null);
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    email: '',
    phone: '',
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
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
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
        <TabsList className={`grid w-full ${isSuperAdmin ? 'grid-cols-4' : 'grid-cols-1'}`}>
          <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="roles" data-testid="tab-roles">Roles</TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="holidays" data-testid="tab-holidays">Holidays</TabsTrigger>}
          {isSuperAdmin && <TabsTrigger value="onboarding" data-testid="tab-onboarding">Onboarding</TabsTrigger>}
        </TabsList>

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
          <TabsContent value="onboarding" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Employee Onboarding
                </CardTitle>
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
      </Tabs>

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

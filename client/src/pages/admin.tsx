import { useState, useEffect } from "react";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Shield, Trash2, ChevronDown, ChevronUp, Pencil, Plus, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";

const ALL_PAGES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "event-calendar", label: "Event Calendar" },
  { id: "team-calendar", label: "Team Calendar" },
  { id: "event-database", label: "Event Database" },
  { id: "event-milestones", label: "Event Milestones" },
  { id: "daybook", label: "Daybook" },
  { id: "oak-book", label: "Oak Book" },
  { id: "oak-sales", label: "Oak Sales" },
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

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

  const { data: roles = [], isLoading: rolesLoading } = useQuery<Role[]>({
    queryKey: ['/api/roles'],
    queryFn: async () => {
      const res = await fetch('/api/roles');
      if (!res.ok) throw new Error('Failed to fetch roles');
      return res.json();
    },
  });

  useEffect(() => {
    if (editingRole) {
      setEditRoleLabel(editingRole.label);
      setEditRoleDescription(editingRole.description || '');
    }
  }, [editingRole]);

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

  const openEditDialog = (user: User) => {
    setEditingUser(user);
    setEditRole(user.role);
    setIsEditDialogOpen(true);
  };

  const openEditRoleDialog = (role: Role) => {
    setEditingRole(role);
    setIsEditRoleDialogOpen(true);
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
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="users" data-testid="tab-users">Users</TabsTrigger>
          {isSuperAdmin && <TabsTrigger value="roles" data-testid="tab-roles">Roles</TabsTrigger>}
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
      </Tabs>

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

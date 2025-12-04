import { useState } from "react";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Shield, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const ALL_PAGES = [
  { id: "dashboard", label: "Dashboard" },
  { id: "event-calendar", label: "Event Calendar" },
  { id: "team-calendar", label: "Team Calendar" },
  { id: "event-database", label: "Event Database" },
  { id: "event-milestones", label: "Event Milestones" },
  { id: "daybook", label: "Daybook" },
  { id: "oak-book", label: "Oak Book" },
  { id: "hr", label: "HR" },
  { id: "admin", label: "Admin" },
];

export default function Admin() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users');
      if (!res.ok) throw new Error('Failed to fetch users');
      return res.json();
    },
  });

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

  const togglePermission = (userId: string, pageId: string, currentPages: string[]) => {
    const newPages = currentPages.includes(pageId)
      ? currentPages.filter(p => p !== pageId)
      : [...currentPages, pageId];
    updatePermissionsMutation.mutate({ userId, pageIds: newPages });
  };

  const AddUserForm = () => {
    const { register, handleSubmit } = useForm();
    const onSubmit = (data: any) => {
      createMutation.mutate(data);
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label>Name</Label>
          <Input {...register("name")} required />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input {...register("email")} type="email" required />
        </div>
        <div className="space-y-2">
          <Label>Password</Label>
          <Input {...register("password")} type="password" required />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...register("role")}>
            <option value="employee">Employee</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
            <option value="superadmin">Super Admin</option>
          </select>
        </div>
        <Button type="submit" className="w-full" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Creating...' : 'Create User'}
        </Button>
      </form>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold font-serif text-primary">Admin Panel</h1>
          <p className="text-sm text-muted-foreground">User Access & Configuration</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto" data-testid="button-add-user"><Shield className="h-4 w-4" /> New User</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
            </DialogHeader>
            <AddUserForm />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-lg">User Permissions</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
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
                    <Badge variant="outline" className="capitalize text-xs hidden sm:inline-flex">{user.role}</Badge>
                    {expandedUser === user.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>
                
                {expandedUser === user.id && (
                  <div className="p-3 sm:p-4 border-t space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="capitalize">{user.role}</Badge>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={user.role === 'admin' || user.role === 'superadmin'}
                        onClick={() => deleteMutation.mutate(user.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
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
        </CardContent>
      </Card>
    </div>
  );
}

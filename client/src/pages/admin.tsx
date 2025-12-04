import { useState } from "react";
import { MOCK_USERS, User, ALL_PAGES } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Shield, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useForm } from "react-hook-form";

export default function Admin() {
  const [users, setUsers] = useState<User[]>(MOCK_USERS);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const togglePermission = (userId: string, pageId: string) => {
    setUsers(users.map(u => {
      if (u.id !== userId) return u;
      const newPages = u.allowedPages.includes(pageId)
        ? u.allowedPages.filter(p => p !== pageId)
        : [...u.allowedPages, pageId];
      return { ...u, allowedPages: newPages };
    }));
  };

  const AddUserForm = () => {
     const { register, handleSubmit } = useForm<Partial<User>>();
     const onSubmit = (data: any) => {
        const newUser: User = {
            id: Math.random().toString(36).substr(2, 9),
            name: data.name,
            email: data.email,
            role: data.role,
            avatar: `https://i.pravatar.cc/150?u=${data.name}`,
            allowedPages: ["dashboard"] // Default
        }
        setUsers([...users, newUser]);
        setEditingUser(null);
     };

     return (
         <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
             <div className="space-y-2">
                 <Label>Name</Label>
                 <Input {...register("name")} required />
             </div>
             <div className="space-y-2">
                 <Label>Email</Label>
                 <Input {...register("email")} required />
             </div>
             <div className="space-y-2">
                 <Label>Role</Label>
                 <select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" {...register("role")}>
                     <option value="employee">Employee</option>
                     <option value="manager">Manager</option>
                     <option value="admin">Admin</option>
                 </select>
             </div>
             <Button type="submit" className="w-full">Create User</Button>
         </form>
     )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif text-primary">Admin Panel</h1>
          <p className="text-muted-foreground">User Access & System Configuration</p>
        </div>
        <Dialog>
            <DialogTrigger asChild>
                 <Button className="gap-2"><Shield className="h-4 w-4" /> New User</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Create New User</DialogTitle>
                </DialogHeader>
                <AddUserForm />
            </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>User Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">User</TableHead>
                <TableHead>Role</TableHead>
                {ALL_PAGES.filter(p => p.id !== 'dashboard').map(page => (
                  <TableHead key={page.id} className="text-center text-xs">{page.label}</TableHead>
                ))}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs">
                            {user.name.charAt(0)}
                        </div>
                        <div>
                            <div>{user.name}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                        </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{user.role}</Badge>
                  </TableCell>
                  {ALL_PAGES.filter(p => p.id !== 'dashboard').map(page => (
                    <TableCell key={page.id} className="text-center">
                      <Checkbox 
                        checked={user.allowedPages.includes(page.id)}
                        onCheckedChange={() => togglePermission(user.id, page.id)}
                        disabled={user.role === 'admin'} // Admins have all access
                      />
                    </TableCell>
                  ))}
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" disabled={user.role === 'admin'}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

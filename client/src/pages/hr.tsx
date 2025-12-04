import { useState, useMemo } from "react";
import type { Employee } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Users, UserMinus } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";

export default function HR() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees');
      if (!res.ok) throw new Error('Failed to fetch employees');
      return res.json();
    },
  });

  const currentEmployees = useMemo(() => {
    return employees.filter(emp => !emp.leaveDate).sort((a, b) => {
      const idA = parseInt(a.employeeId.replace(/\D/g, '')) || 0;
      const idB = parseInt(b.employeeId.replace(/\D/g, '')) || 0;
      return idB - idA;
    });
  }, [employees]);

  const pastEmployees = useMemo(() => {
    return employees.filter(emp => emp.leaveDate).sort((a, b) => {
      const dateA = a.leaveDate ? new Date(a.leaveDate).getTime() : 0;
      const dateB = b.leaveDate ? new Date(b.leaveDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [employees]);

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Employee>) => {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create employee');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setIsDialogOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Employee> }) => {
      const res = await fetch(`/api/employees/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update employee');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setEditingEmployee(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete employee');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
    },
  });

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  const AddEmployeeForm = () => {
    const { register, handleSubmit } = useForm<Partial<Employee>>();
    const onSubmit = (data: any) => {
      const submitData = { ...data };
      if (!submitData.leaveDate) {
        delete submitData.leaveDate;
      }
      createMutation.mutate(submitData);
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Employee ID</Label>
            <Input {...register("employeeId")} required placeholder="e.g. OAK008" data-testid="input-employee-id" />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input {...register("name")} required placeholder="Full Name" data-testid="input-name" />
          </div>
          <div className="space-y-2">
            <Label>Designation</Label>
            <Input {...register("designation")} required placeholder="e.g. Wedding Planner" data-testid="input-designation" />
          </div>
          <div className="space-y-2">
            <Label>Salary (₹)</Label>
            <Input type="number" {...register("salary")} required placeholder="0" data-testid="input-salary" />
          </div>
          <div className="space-y-2">
            <Label>Joining Date</Label>
            <Input type="date" {...register("joinDate")} required data-testid="input-join-date" />
          </div>
          <div className="space-y-2">
            <Label>Date of Leaving (Optional)</Label>
            <Input type="date" {...register("leaveDate")} data-testid="input-leave-date" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input {...register("address")} required placeholder="Full Address" data-testid="input-address" />
        </div>
        <div className="space-y-2">
          <Label>Emergency Contact</Label>
          <Input {...register("emergencyContact")} required placeholder="Phone Number" data-testid="input-emergency-contact" />
        </div>
        <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-employee">
          {createMutation.isPending ? 'Adding...' : 'Add Employee'}
        </Button>
      </form>
    );
  };

  const EditEmployeeForm = ({ employee }: { employee: Employee }) => {
    const { register, handleSubmit } = useForm<Partial<Employee>>({
      defaultValues: {
        employeeId: employee.employeeId,
        name: employee.name,
        designation: employee.designation,
        salary: employee.salary,
        joinDate: employee.joinDate,
        leaveDate: employee.leaveDate || '',
        address: employee.address,
        emergencyContact: employee.emergencyContact,
      }
    });

    const onSubmit = (data: any) => {
      const submitData = { ...data };
      if (!submitData.leaveDate) {
        submitData.leaveDate = null;
      }
      updateMutation.mutate({ id: employee.id, data: submitData });
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Employee ID</Label>
            <Input {...register("employeeId")} required data-testid="input-edit-employee-id" />
          </div>
          <div className="space-y-2">
            <Label>Name</Label>
            <Input {...register("name")} required data-testid="input-edit-name" />
          </div>
          <div className="space-y-2">
            <Label>Designation</Label>
            <Input {...register("designation")} required data-testid="input-edit-designation" />
          </div>
          <div className="space-y-2">
            <Label>Salary (₹)</Label>
            <Input type="number" {...register("salary")} required data-testid="input-edit-salary" />
          </div>
          <div className="space-y-2">
            <Label>Joining Date</Label>
            <Input type="date" {...register("joinDate")} required data-testid="input-edit-join-date" />
          </div>
          <div className="space-y-2">
            <Label>Date of Leaving</Label>
            <Input type="date" {...register("leaveDate")} data-testid="input-edit-leave-date" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input {...register("address")} required data-testid="input-edit-address" />
        </div>
        <div className="space-y-2">
          <Label>Emergency Contact</Label>
          <Input {...register("emergencyContact")} required data-testid="input-edit-emergency-contact" />
        </div>
        <Button type="submit" className="w-full" disabled={updateMutation.isPending} data-testid="button-save-employee">
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    );
  };

  const EmployeeTable = ({ employeeList, isPast = false }: { employeeList: Employee[]; isPast?: boolean }) => (
    <div className="overflow-x-auto -mx-4 sm:mx-0">
      <div className="min-w-[600px] px-4 sm:px-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-800/50">
              <TableHead className="text-xs sm:text-sm font-semibold">Emp. ID</TableHead>
              <TableHead className="text-xs sm:text-sm font-semibold">Name</TableHead>
              <TableHead className="text-xs sm:text-sm font-semibold">Designation</TableHead>
              <TableHead className="text-xs sm:text-sm font-semibold">Salary</TableHead>
              <TableHead className="text-xs sm:text-sm font-semibold">Joined</TableHead>
              {isPast && <TableHead className="text-xs sm:text-sm font-semibold">Left</TableHead>}
              {isAdmin && <TableHead className="text-xs sm:text-sm font-semibold text-center">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {employeeList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isPast ? 7 : 6} className="text-center py-8 text-muted-foreground text-sm">
                  {isPast ? "No past employees." : "No current employees."}
                </TableCell>
              </TableRow>
            ) : (
              employeeList.map((emp) => (
                <TableRow key={emp.id} className="border-b border-slate-700/50" data-testid={`row-employee-${emp.id}`}>
                  <TableCell className="text-xs sm:text-sm font-mono text-amber-400">{emp.employeeId}</TableCell>
                  <TableCell className="text-xs sm:text-sm font-medium">{emp.name}</TableCell>
                  <TableCell className="text-xs sm:text-sm">{emp.designation}</TableCell>
                  <TableCell className="text-xs sm:text-sm font-mono">₹{Number(emp.salary).toLocaleString()}</TableCell>
                  <TableCell className="text-xs sm:text-sm">{formatDate(emp.joinDate)}</TableCell>
                  {isPast && <TableCell className="text-xs sm:text-sm text-red-400">{formatDate(emp.leaveDate)}</TableCell>}
                  {isAdmin && (
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <Dialog open={editingEmployee?.id === emp.id} onOpenChange={(open) => !open && setEditingEmployee(null)}>
                          <DialogTrigger asChild>
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-8 w-8 text-amber-400 hover:text-amber-300 hover:bg-amber-400/10"
                              onClick={() => setEditingEmployee(emp)}
                              data-testid={`button-edit-employee-${emp.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-[95vw] sm:max-w-lg">
                            <DialogHeader>
                              <DialogTitle>Edit Employee</DialogTitle>
                            </DialogHeader>
                            <EditEmployeeForm employee={emp} />
                          </DialogContent>
                        </Dialog>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                          onClick={() => {
                            if (confirm(`Delete ${emp.name}? This action cannot be undone.`)) {
                              deleteMutation.mutate(emp.id);
                            }
                          }}
                          data-testid={`button-delete-employee-${emp.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const totalCurrentSalary = currentEmployees.reduce((acc, emp) => acc + Number(emp.salary), 0);

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold font-serif text-primary">Oak HR</h1>
          <p className="text-sm text-muted-foreground">Employee Management</p>
        </div>
        {isAdmin && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 w-full sm:w-auto" data-testid="button-add-employee">
                <Plus className="h-4 w-4" /> New Employee
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-[95vw] sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
              </DialogHeader>
              <AddEmployeeForm />
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="current" className="space-y-4">
        <TabsList className="w-full sm:w-auto flex">
          <TabsTrigger value="current" className="flex-1 sm:flex-none text-xs sm:text-sm gap-2">
            <Users className="h-4 w-4" />
            Current ({currentEmployees.length})
          </TabsTrigger>
          <TabsTrigger value="past" className="flex-1 sm:flex-none text-xs sm:text-sm gap-2">
            <UserMinus className="h-4 w-4" />
            Past ({pastEmployees.length})
          </TabsTrigger>
          <TabsTrigger value="payroll" className="flex-1 sm:flex-none text-xs sm:text-sm">Payroll</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-serif flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  Current Employees
                </CardTitle>
                <div className="text-sm text-muted-foreground">
                  {currentEmployees.length} employee{currentEmployees.length !== 1 ? 's' : ''}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <EmployeeTable employeeList={currentEmployees} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="past" className="space-y-4">
          <Card>
            <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-serif flex items-center gap-2">
                  <UserMinus className="h-5 w-5 text-muted-foreground" />
                  Past Employees
                </CardTitle>
                <div className="text-sm text-muted-foreground">
                  {pastEmployees.length} employee{pastEmployees.length !== 1 ? 's' : ''}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <EmployeeTable employeeList={pastEmployees} isPast />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg font-serif">Monthly Payroll Summary</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[400px] px-4 sm:px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Employee</TableHead>
                        <TableHead className="text-xs sm:text-sm">Designation</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">Salary</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentEmployees.map(emp => (
                        <TableRow key={emp.id}>
                          <TableCell className="text-xs sm:text-sm font-medium">{emp.name}</TableCell>
                          <TableCell className="text-xs sm:text-sm text-muted-foreground">{emp.designation}</TableCell>
                          <TableCell className="text-right font-mono text-xs sm:text-sm">₹{Number(emp.salary).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      {currentEmployees.length > 0 && (
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell colSpan={2} className="text-xs sm:text-sm">Total Monthly Payroll</TableCell>
                          <TableCell className="text-right text-primary font-mono text-xs sm:text-sm">
                            ₹{totalCurrentSalary.toLocaleString()}
                          </TableCell>
                        </TableRow>
                      )}
                      {currentEmployees.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground text-sm">
                            No current employees to show payroll.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

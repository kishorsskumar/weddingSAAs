import { useState, useMemo } from "react";
import type { Employee } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Users, UserMinus, Calendar, CheckCircle, DollarSign, Wallet, Building2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";

interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: string;
  totalAmount: string;
  payDate: string | null;
  bankId: string | null;
  note: string | null;
  createdAt: string;
}

interface PayrollItem {
  id: string;
  payrollRunId: string;
  employeeId: string;
  employeeName: string;
  monthlySalary: string;
  daysWorked: number;
  dailyRate: string;
  grossPay: string;
  deductions: string;
  netPay: string;
}

interface Bank {
  id: string;
  name: string;
  balance: string;
}

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
          <PayrollSection 
            currentEmployees={currentEmployees} 
            totalCurrentSalary={totalCurrentSalary}
            isAdmin={isAdmin}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PayrollSection({ currentEmployees, totalCurrentSalary, isAdmin }: { 
  currentEmployees: Employee[]; 
  totalCurrentSalary: number;
  isAdmin: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [employeeDays, setEmployeeDays] = useState<Record<string, number>>({});
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');

  const { data: payrollRuns = [] } = useQuery<PayrollRun[]>({
    queryKey: ['/api/payroll-runs'],
    queryFn: async () => {
      const res = await fetch('/api/payroll-runs');
      if (!res.ok) throw new Error('Failed to fetch payroll runs');
      return res.json();
    },
  });

  const { data: banks = [] } = useQuery<Bank[]>({
    queryKey: ['/api/banks'],
    queryFn: async () => {
      const res = await fetch('/api/banks');
      if (!res.ok) throw new Error('Failed to fetch banks');
      return res.json();
    },
  });

  const selectedRun = useMemo(() => {
    return payrollRuns.find(r => r.month === selectedMonth && r.year === selectedYear);
  }, [payrollRuns, selectedMonth, selectedYear]);

  const { data: payrollItems = [] } = useQuery<PayrollItem[]>({
    queryKey: ['/api/payroll-runs', selectedRun?.id, 'items'],
    queryFn: async () => {
      if (!selectedRun) return [];
      const res = await fetch(`/api/payroll-runs/${selectedRun.id}/items`);
      if (!res.ok) throw new Error('Failed to fetch payroll items');
      return res.json();
    },
    enabled: !!selectedRun,
  });

  const createPayrollMutation = useMutation({
    mutationFn: async () => {
      const employees = currentEmployees.map(emp => ({
        id: emp.id,
        name: emp.name,
        salary: emp.salary,
        daysWorked: employeeDays[emp.id] || 30,
        deductions: '0',
      }));
      
      const res = await fetch('/api/payroll-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: selectedMonth, year: selectedYear, employees }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create payroll');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payroll-runs'] });
      setIsCreateDialogOpen(false);
      setEmployeeDays({});
      toast({ title: 'Payroll created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const payPayrollMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRunId) throw new Error('No payroll selected');
      const res = await fetch(`/api/payroll-runs/${selectedRunId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payDate, bankId: selectedBankId || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to pay payroll');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payroll-runs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/daybook'] });
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
      setIsPayDialogOpen(false);
      setSelectedRunId(null);
      toast({ title: 'Payroll marked as paid', description: 'Entry added to daybook' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deletePayrollMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/payroll-runs/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete payroll');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payroll-runs'] });
      toast({ title: 'Payroll deleted' });
    },
  });

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const openCreateDialog = () => {
    const defaultDays: Record<string, number> = {};
    currentEmployees.forEach(emp => {
      defaultDays[emp.id] = 30;
    });
    setEmployeeDays(defaultDays);
    setIsCreateDialogOpen(true);
  };

  const openPayDialog = (runId: string) => {
    setSelectedRunId(runId);
    setPayDate(new Date().toISOString().split('T')[0]);
    setSelectedBankId('');
    setIsPayDialogOpen(true);
  };

  const calculatePayrollPreview = () => {
    return currentEmployees.map(emp => {
      const days = employeeDays[emp.id] || 30;
      const dailyRate = Number(emp.salary) / 30;
      const grossPay = dailyRate * days;
      return { ...emp, daysWorked: days, dailyRate, grossPay };
    });
  };

  const previewTotal = calculatePayrollPreview().reduce((sum, emp) => sum + emp.grossPay, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-serif flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                Monthly Payroll
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Create and manage monthly payroll for employees
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
                <SelectTrigger className="w-[130px] text-xs sm:text-sm" data-testid="select-month">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthNames.map((month, idx) => (
                    <SelectItem key={idx} value={String(idx + 1)}>{month}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                <SelectTrigger className="w-[90px] text-xs sm:text-sm" data-testid="select-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map(year => (
                    <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {selectedRun ? (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant={selectedRun.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                    {selectedRun.status === 'paid' ? (
                      <><CheckCircle className="h-3 w-3 mr-1" /> Paid</>
                    ) : (
                      <><Calendar className="h-3 w-3 mr-1" /> Draft</>
                    )}
                  </Badge>
                  <span className="text-sm font-medium">
                    {monthNames[selectedRun.month - 1]} {selectedRun.year}
                  </span>
                  <span className="text-lg font-bold text-primary">
                    ₹{Number(selectedRun.totalAmount).toLocaleString()}
                  </span>
                </div>
                <div className="flex gap-2">
                  {selectedRun.status === 'draft' && isAdmin && (
                    <>
                      <Button 
                        size="sm" 
                        onClick={() => openPayDialog(selectedRun.id)}
                        data-testid="button-mark-paid"
                      >
                        <DollarSign className="h-4 w-4 mr-1" /> Mark as Paid
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => {
                          if (confirm('Delete this payroll run?')) {
                            deletePayrollMutation.mutate(selectedRun.id);
                          }
                        }}
                        data-testid="button-delete-payroll"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {selectedRun.status === 'paid' && selectedRun.payDate && (
                    <span className="text-xs text-muted-foreground">
                      Paid on {format(parseISO(selectedRun.payDate), 'dd/MM/yyyy')}
                    </span>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[500px] px-4 sm:px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Employee</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">Monthly Salary</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">Days Worked</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">Daily Rate</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">Net Pay</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollItems.map(item => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs sm:text-sm font-medium">{item.employeeName}</TableCell>
                          <TableCell className="text-right font-mono text-xs sm:text-sm">
                            ₹{Number(item.monthlySalary).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-xs sm:text-sm">{item.daysWorked}</TableCell>
                          <TableCell className="text-right font-mono text-xs sm:text-sm">
                            ₹{Number(item.dailyRate).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs sm:text-sm font-bold">
                            ₹{Number(item.netPay).toLocaleString()}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={4} className="text-xs sm:text-sm">Total Payroll</TableCell>
                        <TableCell className="text-right text-primary font-mono text-xs sm:text-sm">
                          ₹{Number(selectedRun.totalAmount).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <Wallet className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground text-sm mb-4">
                No payroll created for {monthNames[selectedMonth - 1]} {selectedYear}
              </p>
              {isAdmin && currentEmployees.length > 0 && (
                <Button onClick={openCreateDialog} data-testid="button-create-payroll">
                  <Plus className="h-4 w-4 mr-2" /> Create Payroll
                </Button>
              )}
              {currentEmployees.length === 0 && (
                <p className="text-xs text-muted-foreground">Add employees first to create payroll</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 sm:p-6 pb-2 sm:pb-4">
          <CardTitle className="text-lg font-serif">Payroll History</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="overflow-x-auto -mx-4 sm:mx-0">
            <div className="min-w-[400px] px-4 sm:px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs sm:text-sm">Month</TableHead>
                    <TableHead className="text-xs sm:text-sm">Status</TableHead>
                    <TableHead className="text-right text-xs sm:text-sm">Amount</TableHead>
                    <TableHead className="text-xs sm:text-sm">Pay Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollRuns.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                        No payroll history yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    payrollRuns.map(run => (
                      <TableRow 
                        key={run.id} 
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => {
                          setSelectedMonth(run.month);
                          setSelectedYear(run.year);
                        }}
                      >
                        <TableCell className="text-xs sm:text-sm font-medium">
                          {monthNames[run.month - 1]} {run.year}
                        </TableCell>
                        <TableCell>
                          <Badge variant={run.status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                            {run.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs sm:text-sm">
                          ₹{Number(run.totalAmount).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs sm:text-sm text-muted-foreground">
                          {run.payDate ? format(parseISO(run.payDate), 'dd/MM/yyyy') : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Payroll - {monthNames[selectedMonth - 1]} {selectedYear}</DialogTitle>
            <DialogDescription>
              Enter the number of days worked for each employee
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">Employee</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">Salary</TableHead>
                  <TableHead className="text-center text-xs sm:text-sm">Days Worked</TableHead>
                  <TableHead className="text-right text-xs sm:text-sm">Calculated Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calculatePayrollPreview().map(emp => (
                  <TableRow key={emp.id}>
                    <TableCell className="text-xs sm:text-sm font-medium">{emp.name}</TableCell>
                    <TableCell className="text-right font-mono text-xs sm:text-sm">
                      ₹{Number(emp.salary).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min="0"
                        max="31"
                        value={employeeDays[emp.id] || 30}
                        onChange={e => setEmployeeDays(prev => ({
                          ...prev,
                          [emp.id]: Math.min(31, Math.max(0, Number(e.target.value)))
                        }))}
                        className="w-16 text-center text-xs sm:text-sm mx-auto"
                        data-testid={`input-days-${emp.id}`}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs sm:text-sm font-bold">
                      ₹{emp.grossPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell colSpan={3} className="text-xs sm:text-sm">Total Payroll</TableCell>
                  <TableCell className="text-right text-primary font-mono text-xs sm:text-sm">
                    ₹{previewTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => createPayrollMutation.mutate()}
              disabled={createPayrollMutation.isPending}
              data-testid="button-confirm-create-payroll"
            >
              {createPayrollMutation.isPending ? 'Creating...' : 'Create Payroll'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isPayDialogOpen} onOpenChange={setIsPayDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Payroll as Paid</DialogTitle>
            <DialogDescription>
              This will add an expense entry to your daybook
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input
                type="date"
                value={payDate}
                onChange={e => setPayDate(e.target.value)}
                data-testid="input-pay-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Bank Account (Optional)</Label>
              <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                <SelectTrigger data-testid="select-bank">
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No bank (Cash)</SelectItem>
                  {banks.map(bank => (
                    <SelectItem key={bank.id} value={bank.id}>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {bank.name} (₹{Number(bank.balance).toLocaleString()})
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                If selected, the amount will be deducted from bank balance
              </p>
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsPayDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={() => payPayrollMutation.mutate()}
              disabled={payPayrollMutation.isPending}
              data-testid="button-confirm-pay"
            >
              {payPayrollMutation.isPending ? 'Processing...' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

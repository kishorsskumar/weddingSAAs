import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import type { Employee } from "@/lib/types";
import yepmanLogo from "@assets/Yepman_1767319118647.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Plus, Pencil, Trash2, Users, UserMinus, Calendar, CheckCircle, DollarSign, Wallet, Building2, Download, Save, X, ClipboardCheck, Clock, CheckCircle2, XCircle, Receipt, Banknote, FileBarChart, TrendingUp, AlertCircle, Loader2, Copy, Key, BookOpen, Check, ChevronsUpDown, Upload, Send, RefreshCw } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { PhotoUploader } from "@/components/PhotoUploader";
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

interface ConsolidatedEmployeeData {
  employee: {
    id: string;
    employeeId: string;
    name: string;
    designation: string;
    department: string | null;
    salary: string;
    joinDate: string;
    contractRenewalDate: string | null;
    email: string | null;
    phone: string | null;
    managerName: string | null;
  };
  leaveMetrics: {
    totalLeaves: number;
    leavesUsed: number;
    leavesRemaining: number;
    lossOfPayDays: number;
    casualLeavesTaken: number;
    sickLeavesTaken: number;
    earnedLeavesTaken: number;
  };
  financialMetrics: {
    monthlySalary: number;
    lossOfPayAmount: number;
    pendingAdvances: number;
    approvedAdvances: number;
    approvedExpenses: number;
    totalIncentives: number;
    netPayroll: number;
  };
  increments: any[];
  contractRenewalDate: string | null;
}

interface ConsolidatedReport {
  fiscalYear: string;
  employees: ConsolidatedEmployeeData[];
  summary: {
    totalEmployees: number;
    totalPayroll: number;
    totalIncentives: number;
    totalLossOfPay: number;
    totalAdvances: number;
    totalExpenses: number;
  };
}

interface Manager {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function HR() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  const [mainTab, setMainTab] = useState("current");
  const [approvalTab, setApprovalTab] = useState("leaves");
  const [location] = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperAdmin = user?.role === 'superadmin';

  // Handle URL tab parameter for deep linking from dashboard
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab && ['leaves', 'advances', 'expenses', 'quick-entries', 'approved-payouts'].includes(tab)) {
      setMainTab('approvals'); // Switch to approvals tab first
      setApprovalTab(tab);
    }
  }, [location]);

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees');
      if (!res.ok) throw new Error('Failed to fetch employees');
      return res.json();
    },
  });

  const currentEmployees = useMemo(() => {
    return employees.filter(emp => emp.isActive !== false).sort((a, b) => {
      const idA = parseInt(a.employeeId.replace(/\D/g, '')) || 0;
      const idB = parseInt(b.employeeId.replace(/\D/g, '')) || 0;
      return idB - idA;
    });
  }, [employees]);

  const pastEmployees = useMemo(() => {
    return employees.filter(emp => emp.isActive === false).sort((a, b) => {
      const dateA = a.leaveDate ? new Date(a.leaveDate).getTime() : 0;
      const dateB = b.leaveDate ? new Date(b.leaveDate).getTime() : 0;
      return dateB - dateA;
    });
  }, [employees]);

  const { data: consolidatedReport, isLoading: reportLoading } = useQuery<ConsolidatedReport>({
    queryKey: ['/api/hr/consolidated-report'],
    queryFn: async () => {
      const res = await fetch('/api/hr/consolidated-report');
      if (!res.ok) throw new Error('Failed to fetch consolidated report');
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: managers = [] } = useQuery<Manager[]>({
    queryKey: ['/api/admin/managers'],
    queryFn: async () => {
      const res = await fetch('/api/admin/managers');
      if (!res.ok) throw new Error('Failed to fetch managers');
      return res.json();
    },
    enabled: user?.role === 'superadmin',
  });

  const { toast } = useToast();
  const [showCredentials, setShowCredentials] = useState(false);
  const [newCredentials, setNewCredentials] = useState<{ employeeId: string; email: string; temporaryPassword: string } | null>(null);

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Employee>) => {
      const res = await fetch('/api/employees/with-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create employee');
      }
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setIsDialogOpen(false);
      if (result.credentials) {
        setNewCredentials(result.credentials);
        setShowCredentials(true);
      }
      toast({
        title: "Employee Created",
        description: `${result.employee.name} has been added with portal access.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create employee",
        description: error.message,
        variant: "destructive"
      });
    }
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
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      const empName = result?.name || editingEmployee?.name || 'Employee';
      setEditingEmployee(null);
      toast({
        title: "Employee Updated",
        description: `${empName} has been updated successfully.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update employee",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employees/${id}`, { 
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Failed to delete employee');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      setEmployeeToDelete(null);
      toast({
        title: "Employee Deleted",
        description: "The employee has been permanently deleted.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to delete employee",
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive, leaveDate }: { id: string; isActive: boolean; leaveDate?: string }) => {
      const res = await fetch(`/api/admin/employees/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ isActive, leaveDate }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update status');
      }
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      toast({
        title: result.isActive ? "Employee Reactivated" : "Employee Deactivated",
        description: `${result.name} has been ${result.isActive ? 'reactivated' : 'marked as inactive'}.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to update status",
        description: error.message,
        variant: "destructive"
      });
    }
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
    const { register, handleSubmit, watch, setValue, getValues } = useForm<Partial<Employee>>();
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [pendingData, setPendingData] = useState<any>(null);
    const employeeName = watch("name") || "";
    
    const onSubmit = (data: any) => {
      const submitData = { ...data, photoUrl };
      if (!submitData.leaveDate) {
        delete submitData.leaveDate;
      }
      if (!submitData.employeeId) {
        delete submitData.employeeId;
      }
      setPendingData(submitData);
      setShowConfirmDialog(true);
    };

    const confirmCreate = () => {
      if (pendingData) {
        createMutation.mutate(pendingData);
        setShowConfirmDialog(false);
        setPendingData(null);
      }
    };

    return (
      <>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 text-sm">
            <p className="text-blue-700 dark:text-blue-300">
              Employee ID and password will be automatically generated. You can share the login credentials with the employee after creation.
            </p>
          </div>
          
          <div className="flex justify-center py-2">
            <PhotoUploader 
              currentPhotoUrl={photoUrl} 
              onPhotoChange={setPhotoUrl}
              name={employeeName}
            />
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label>Name *</Label>
              <Input {...register("name")} required placeholder="Full Name" data-testid="input-name" />
            </div>
            <div className="space-y-2">
              <Label>Email (for portal login)</Label>
              <Input type="email" {...register("email")} placeholder="employee@example.com (optional)" data-testid="input-email" />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input {...register("phone")} placeholder="Phone Number (optional)" data-testid="input-phone" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp Number</Label>
              <Input {...register("whatsappNumber")} placeholder="e.g. +919876543210" data-testid="input-whatsapp" />
            </div>
            <div className="space-y-2">
              <Label>Date of Birth</Label>
              <Input type="date" {...register("dateOfBirth")} data-testid="input-date-of-birth" />
            </div>
            <div className="space-y-2">
              <Label>Designation *</Label>
              <Input {...register("designation")} required placeholder="e.g. Wedding Planner" data-testid="input-designation" />
            </div>
            <div className="space-y-2">
              <Label>Salary (₹) *</Label>
              <Input type="number" {...register("salary")} required placeholder="0" data-testid="input-salary" />
            </div>
            <div className="space-y-2">
              <Label>Joining Date *</Label>
              <Input type="date" {...register("joinDate")} required data-testid="input-join-date" />
            </div>
            <div className="space-y-2">
              <Label>Contract Renewal Date</Label>
              <Input type="date" {...register("contractRenewalDate")} data-testid="input-contract-renewal" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Address *</Label>
            <Input {...register("address")} required placeholder="Full Address" data-testid="input-address" />
          </div>
          <div className="space-y-2">
            <Label>Emergency Contact *</Label>
            <Input {...register("emergencyContact")} required placeholder="Emergency Contact Number" data-testid="input-emergency-contact" />
          </div>
          <Button type="submit" className="w-full" disabled={createMutation.isPending} data-testid="button-submit-employee">
            {createMutation.isPending ? 'Creating...' : 'Create Employee with Portal Access'}
          </Button>
        </form>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Confirm Employee Creation</DialogTitle>
              <DialogDescription>
                Are you sure you want to create this new employee?
              </DialogDescription>
            </DialogHeader>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{pendingData?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Designation:</span>
                <span className="font-medium">{pendingData?.designation}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Salary:</span>
                <span className="font-medium">₹{Number(pendingData?.salary || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Join Date:</span>
                <span className="font-medium">{pendingData?.joinDate}</span>
              </div>
            </div>
            <DialogFooter className="flex gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                Cancel
              </Button>
              <Button onClick={confirmCreate} disabled={createMutation.isPending} className="gap-2">
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Confirm & Create
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  };

  const EditEmployeeForm = ({ employee }: { employee: Employee }) => {
    const { register, handleSubmit, watch, reset } = useForm<Partial<Employee>>({
      defaultValues: {
        employeeId: employee.employeeId,
        name: employee.name,
        designation: employee.designation,
        department: employee.department || '',
        salary: employee.salary,
        dateOfBirth: employee.dateOfBirth || '',
        joinDate: employee.joinDate,
        contractRenewalDate: employee.contractRenewalDate || '',
        leaveDate: employee.leaveDate || '',
        address: employee.address,
        emergencyContact: employee.emergencyContact,
        phone: employee.phone || '',
        whatsappNumber: employee.whatsappNumber || '',
        email: employee.email || '',
        bankAccountNumber: employee.bankAccountNumber || '',
        bankIfscCode: employee.bankIfscCode || '',
        panNumber: employee.panNumber || '',
        totalLeavesPerYear: employee.totalLeavesPerYear || 24,
        duties: employee.duties || '',
        responsibilities: employee.responsibilities || '',
      }
    });
    const [photoUrl, setPhotoUrl] = useState<string | null>(employee.photoUrl || null);
    const employeeName = watch("name") || employee.name;

    useEffect(() => {
      reset({
        employeeId: employee.employeeId,
        name: employee.name,
        designation: employee.designation,
        department: employee.department || '',
        salary: employee.salary,
        dateOfBirth: employee.dateOfBirth || '',
        joinDate: employee.joinDate,
        contractRenewalDate: employee.contractRenewalDate || '',
        leaveDate: employee.leaveDate || '',
        address: employee.address,
        emergencyContact: employee.emergencyContact,
        phone: employee.phone || '',
        whatsappNumber: employee.whatsappNumber || '',
        email: employee.email || '',
        bankAccountNumber: employee.bankAccountNumber || '',
        bankIfscCode: employee.bankIfscCode || '',
        panNumber: employee.panNumber || '',
        totalLeavesPerYear: employee.totalLeavesPerYear || 24,
        duties: employee.duties || '',
        responsibilities: employee.responsibilities || '',
      });
      setPhotoUrl(employee.photoUrl || null);
    }, [employee, reset]);

    const onSubmit = (data: any) => {
      const submitData = { ...data, photoUrl };
      submitData.salary = String(submitData.salary);
      submitData.totalLeavesPerYear = submitData.totalLeavesPerYear ? Number(submitData.totalLeavesPerYear) : null;
      if (!submitData.leaveDate) submitData.leaveDate = null;
      if (!submitData.dateOfBirth) submitData.dateOfBirth = null;
      if (!submitData.contractRenewalDate) submitData.contractRenewalDate = null;
      if (!submitData.department) submitData.department = null;
      if (!submitData.phone) submitData.phone = null;
      if (!submitData.whatsappNumber) submitData.whatsappNumber = null;
      if (!submitData.email) submitData.email = null;
      if (!submitData.bankAccountNumber) submitData.bankAccountNumber = null;
      if (!submitData.bankIfscCode) submitData.bankIfscCode = null;
      if (!submitData.panNumber) submitData.panNumber = null;
      if (!submitData.duties) submitData.duties = null;
      if (!submitData.responsibilities) submitData.responsibilities = null;
      updateMutation.mutate({ id: employee.id, data: submitData });
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div className="flex justify-center py-2">
          <PhotoUploader 
            currentPhotoUrl={photoUrl} 
            onPhotoChange={setPhotoUrl}
            name={employeeName}
          />
        </div>
        
        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-muted-foreground border-b pb-2">Basic Information</h4>
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
              <Label>Date of Birth</Label>
              <Input type="date" {...register("dateOfBirth")} data-testid="input-edit-date-of-birth" />
            </div>
            <div className="space-y-2">
              <Label>Designation</Label>
              <Input {...register("designation")} required data-testid="input-edit-designation" />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Input {...register("department")} data-testid="input-edit-department" placeholder="e.g., Production, Marketing" />
            </div>
            <div className="space-y-2">
              <Label>Salary (₹)</Label>
              <Input type="number" {...register("salary")} required data-testid="input-edit-salary" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-muted-foreground border-b pb-2">Employment Dates</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Joining Date</Label>
              <Input type="date" {...register("joinDate")} required data-testid="input-edit-join-date" />
            </div>
            <div className="space-y-2">
              <Label>Contract Renewal Date</Label>
              <Input type="date" {...register("contractRenewalDate")} data-testid="input-edit-contract-renewal" />
            </div>
            <div className="space-y-2">
              <Label>Date of Leaving</Label>
              <Input type="date" {...register("leaveDate")} data-testid="input-edit-leave-date" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-muted-foreground border-b pb-2">Contact Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input {...register("phone")} data-testid="input-edit-phone" placeholder="Mobile number" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp Number</Label>
              <Input {...register("whatsappNumber")} data-testid="input-edit-whatsapp" placeholder="e.g. +919876543210" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" {...register("email")} data-testid="input-edit-email" placeholder="Email address" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Address</Label>
              <Input {...register("address")} required data-testid="input-edit-address" />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Emergency Contact</Label>
              <Input {...register("emergencyContact")} required data-testid="input-edit-emergency-contact" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-muted-foreground border-b pb-2">Bank & Tax Details</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Bank Account Number</Label>
              <Input {...register("bankAccountNumber")} data-testid="input-edit-bank-account" />
            </div>
            <div className="space-y-2">
              <Label>IFSC Code</Label>
              <Input {...register("bankIfscCode")} data-testid="input-edit-ifsc" />
            </div>
            <div className="space-y-2">
              <Label>PAN Number</Label>
              <Input {...register("panNumber")} data-testid="input-edit-pan" />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-semibold text-sm text-muted-foreground border-b pb-2">Leave & Duties</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Total Leaves Per Year</Label>
              <Input type="number" {...register("totalLeavesPerYear")} data-testid="input-edit-leaves" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Duties</Label>
            <textarea 
              {...register("duties")} 
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="input-edit-duties"
              placeholder="Job duties..."
            />
          </div>
          <div className="space-y-2">
            <Label>Responsibilities</Label>
            <textarea 
              {...register("responsibilities")} 
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="input-edit-responsibilities"
              placeholder="Key responsibilities..."
            />
          </div>
        </div>

        <Button type="submit" className="w-full" disabled={updateMutation.isPending} data-testid="button-save-employee">
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    );
  };

  const EmployeeTable = ({ employeeList, isPast = false }: { employeeList: Employee[]; isPast?: boolean }) => (
    <>
      {/* Mobile Card Layout */}
      <div className="sm:hidden space-y-3">
        {employeeList.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {isPast ? "No past employees." : "No current employees."}
          </div>
        ) : (
          employeeList.map((emp) => (
            <div 
              key={emp.id} 
              className="bg-muted/30 rounded-lg p-3 space-y-2 border border-border/50"
              data-testid={`card-employee-${emp.id}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-sm">{emp.name}</div>
                  <div className="text-xs text-muted-foreground">{emp.designation}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs text-amber-400">{emp.employeeId}</div>
                  <div className="font-mono text-sm font-semibold">₹{Number(emp.salary).toLocaleString()}</div>
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/30">
                <span>Joined: {formatDate(emp.joinDate)}</span>
                {isPast && <span className="text-red-400">Left: {formatDate(emp.leaveDate)}</span>}
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <Dialog open={editingEmployee?.id === emp.id} onOpenChange={(open) => !open && setEditingEmployee(null)}>
                      <DialogTrigger asChild>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-7 w-7 text-amber-400"
                          onClick={() => setEditingEmployee(emp)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                          <DialogTitle>Edit Employee</DialogTitle>
                        </DialogHeader>
                        <EditEmployeeForm key={emp.id} employee={emp} />
                      </DialogContent>
                    </Dialog>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-7 w-7 text-red-400"
                      onClick={() => setEmployeeToDelete(emp)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                    {user?.role === 'superadmin' && (
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className={isPast ? "h-7 w-7 text-green-400" : "h-7 w-7 text-orange-400"}
                        onClick={() => {
                          if (confirm(`${isPast ? 'Reactivate' : 'Deactivate'} ${emp.name}?`)) {
                            toggleStatusMutation.mutate({
                              id: emp.id,
                              isActive: isPast,
                              leaveDate: isPast ? undefined : new Date().toISOString().split('T')[0]
                            });
                          }
                        }}
                      >
                        {isPast ? <CheckCircle className="h-3.5 w-3.5" /> : <UserMinus className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden sm:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-800/50">
              <TableHead className="text-sm font-semibold">Emp. ID</TableHead>
              <TableHead className="text-sm font-semibold">Name</TableHead>
              <TableHead className="text-sm font-semibold">Designation</TableHead>
              <TableHead className="text-sm font-semibold">Salary</TableHead>
              <TableHead className="text-sm font-semibold">Joined</TableHead>
              {isPast && <TableHead className="text-sm font-semibold">Left</TableHead>}
              {isAdmin && <TableHead className="text-sm font-semibold text-center">Actions</TableHead>}
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
                  <TableCell className="text-sm font-mono text-amber-400">{emp.employeeId}</TableCell>
                  <TableCell className="text-sm font-medium">{emp.name}</TableCell>
                  <TableCell className="text-sm">{emp.designation}</TableCell>
                  <TableCell className="text-sm font-mono">₹{Number(emp.salary).toLocaleString()}</TableCell>
                  <TableCell className="text-sm">{formatDate(emp.joinDate)}</TableCell>
                  {isPast && <TableCell className="text-sm text-red-400">{formatDate(emp.leaveDate)}</TableCell>}
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
                          <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Edit Employee</DialogTitle>
                            </DialogHeader>
                            <EditEmployeeForm key={emp.id} employee={emp} />
                          </DialogContent>
                        </Dialog>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                          onClick={() => setEmployeeToDelete(emp)}
                          data-testid={`button-delete-employee-${emp.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        {user?.role === 'superadmin' && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className={isPast ? "h-8 w-8 text-green-400 hover:text-green-300 hover:bg-green-400/10" : "h-8 w-8 text-orange-400 hover:text-orange-300 hover:bg-orange-400/10"}
                            onClick={() => {
                              if (confirm(`${isPast ? 'Reactivate' : 'Deactivate'} ${emp.name}? ${isPast ? 'They will appear in current employees.' : 'They will be moved to past employees but all data will be preserved.'}`)) {
                                toggleStatusMutation.mutate({
                                  id: emp.id,
                                  isActive: isPast,
                                  leaveDate: isPast ? undefined : new Date().toISOString().split('T')[0]
                                });
                              }
                            }}
                            title={isPast ? "Reactivate Employee" : "Deactivate Employee"}
                            data-testid={`button-toggle-status-${emp.id}`}
                          >
                            {isPast ? <CheckCircle className="h-4 w-4" /> : <UserMinus className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </>
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
            <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New Employee</DialogTitle>
                <DialogDescription>
                  Employee will automatically get portal login credentials
                </DialogDescription>
              </DialogHeader>
              <AddEmployeeForm />
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Delete Employee Confirmation Dialog */}
      <AlertDialog open={!!employeeToDelete} onOpenChange={(open) => !open && setEmployeeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Do you want to delete this employee?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {employeeToDelete?.name} ({employeeToDelete?.employeeId}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700"
              onClick={() => employeeToDelete && deleteMutation.mutate(employeeToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Credentials Dialog */}
      <Dialog open={showCredentials} onOpenChange={setShowCredentials}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Employee Portal Credentials
            </DialogTitle>
            <DialogDescription>
              Share these login details with the employee. The password should be changed on first login.
            </DialogDescription>
          </DialogHeader>
          {newCredentials && (
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground">Employee ID</Label>
                  <p className="font-mono font-medium" data-testid="text-credential-employee-id">{newCredentials.employeeId}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Email (Login)</Label>
                  <p className="font-mono font-medium" data-testid="text-credential-email">{newCredentials.email}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">Temporary Password</Label>
                  <p className="font-mono font-medium text-primary" data-testid="text-credential-password">{newCredentials.temporaryPassword}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const text = `Employee Portal Login\n\nEmployee ID: ${newCredentials.employeeId}\nEmail: ${newCredentials.email}\nPassword: ${newCredentials.temporaryPassword}\n\nPlease change your password after first login.`;
                    navigator.clipboard.writeText(text);
                    toast({ title: "Copied to clipboard" });
                  }}
                  data-testid="button-copy-credentials"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </Button>
                <Button className="flex-1" onClick={() => setShowCredentials(false)} data-testid="button-close-credentials">
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4">
        <div className="overflow-x-auto -mx-2 px-2 sm:mx-0 sm:px-0">
          <TabsList className="inline-flex w-max sm:w-auto gap-1">
            <TabsTrigger value="current" className="text-xs sm:text-sm gap-1.5 px-2.5 sm:px-3">
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Current</span> ({currentEmployees.length})
            </TabsTrigger>
            <TabsTrigger value="past" className="text-xs sm:text-sm gap-1.5 px-2.5 sm:px-3">
              <UserMinus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Past</span> ({pastEmployees.length})
            </TabsTrigger>
            <TabsTrigger value="payroll" className="text-xs sm:text-sm px-2.5 sm:px-3">Payroll</TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="salary-slips" className="text-xs sm:text-sm gap-1.5 px-2.5 sm:px-3">
                <Receipt className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Salary Slips</span>
                <span className="sm:hidden">Slips</span>
              </TabsTrigger>
            )}
            {(isAdmin || user?.role === 'manager') && (
              <TabsTrigger value="approvals" className="text-xs sm:text-sm gap-1.5 px-2.5 sm:px-3">
                <ClipboardCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Approvals</span>
                <span className="sm:hidden">Approve</span>
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="leave-tracker" className="text-xs sm:text-sm gap-1.5 px-2.5 sm:px-3">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Leave Tracker</span>
                <span className="sm:hidden">Leaves</span>
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="report" className="text-xs sm:text-sm gap-1.5 px-2.5 sm:px-3" data-testid="tab-consolidated-report">
                <FileBarChart className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Report
              </TabsTrigger>
            )}
          </TabsList>
        </div>

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
            allEmployees={employees}
            totalCurrentSalary={totalCurrentSalary}
            isSuperAdmin={isSuperAdmin}
            isAdmin={isAdmin}
          />
        </TabsContent>

        {isAdmin && (
          <TabsContent value="salary-slips">
            <SalarySlipsSection />
          </TabsContent>
        )}

        {(isAdmin || user?.role === 'manager') && (
          <TabsContent value="approvals">
            <ManagerApprovalsSection isAdmin={isAdmin} approvalTab={approvalTab} setApprovalTab={setApprovalTab} />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="leave-tracker">
            <LeaveTrackerSection employees={employees} />
          </TabsContent>
        )}

        {/* Consolidated Report Tab */}
        {isAdmin && (
          <TabsContent value="report">
            <ConsolidatedReportSection />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function PayrollSection({ currentEmployees, allEmployees, totalCurrentSalary, isAdmin, isSuperAdmin }: { 
  currentEmployees: Employee[]; 
  allEmployees: Employee[];
  totalCurrentSalary: number;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  
  // For payroll, include current employees PLUS employees who left during the selected month
  // This ensures employees who leave mid-month still get their payslip for that month
  // Excludes system/test employees like "Oaksy AI" and "test employee"
  const payrollEligibleEmployees = useMemo(() => {
    const excludedNames = ['oaksy ai', 'test employee', 'test'];
    return allEmployees.filter(emp => {
      // Exclude system/test employees
      const nameLower = emp.name.toLowerCase();
      if (excludedNames.some(excluded => nameLower.includes(excluded))) {
        return false;
      }
      
      // Include all current/active employees
      if (emp.isActive !== false) return true;
      
      // Include inactive employees who left during the selected payroll month
      if (emp.leaveDate) {
        const leaveDate = new Date(emp.leaveDate);
        const leaveMonth = leaveDate.getMonth() + 1;
        const leaveYear = leaveDate.getFullYear();
        return leaveMonth === selectedMonth && leaveYear === selectedYear;
      }
      return false;
    });
  }, [allEmployees, selectedMonth, selectedYear]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPayDialogOpen, setIsPayDialogOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [employeeDays, setEmployeeDays] = useState<Record<string, number>>({});
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [isEditMode, setIsEditMode] = useState(false);
  const [editedDays, setEditedDays] = useState<Record<string, number>>({});
  const [editedLopDays, setEditedLopDays] = useState<Record<string, number>>({});
  const [editedAdvance, setEditedAdvance] = useState<Record<string, number>>({});

  const { data: payrollRuns = [] } = useQuery<PayrollRun[]>({
    queryKey: ['/api/payroll-runs'],
    queryFn: async () => {
      const res = await fetch('/api/payroll-runs', {
        credentials: 'include',
      });
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
      const res = await fetch(`/api/payroll-runs/${selectedRun.id}/items`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch payroll items');
      return res.json();
    },
    enabled: !!selectedRun,
  });

  const createPayrollMutation = useMutation({
    mutationFn: async () => {
      const employees = payrollEligibleEmployees.map(emp => ({
        id: emp.id,
        name: emp.name,
        salary: emp.salary,
        daysWorked: employeeDays[emp.id] ?? 30,
        deductions: '0',
      }));
      
      const res = await fetch('/api/payroll-runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
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
        credentials: 'include',
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
      const res = await fetch(`/api/payroll-runs/${id}`, { 
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete payroll');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payroll-runs'] });
      toast({ title: 'Payroll deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const updatePayrollMutation = useMutation({
    mutationFn: async ({ runId, items }: { runId: string; items: { id: string; daysWorked: number }[] }) => {
      const res = await fetch(`/api/payroll-runs/${runId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ items }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update payroll');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/payroll-runs'] });
      setIsEditMode(false);
      setEditedDays({});
      toast({ title: 'Payroll updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const syncEmployeesMutation = useMutation({
    mutationFn: async (runId: string) => {
      const res = await fetch(`/api/payroll-runs/${runId}/sync-employees`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to sync employees');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/payroll-runs'] });
      if (data.added > 0) {
        toast({ title: `Added ${data.added} new employee(s)`, description: data.employees?.join(', ') });
      } else {
        toast({ title: 'All employees already in payroll' });
      }
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

  const openCreateDialog = () => {
    const defaultDays: Record<string, number> = {};
    payrollEligibleEmployees.forEach(emp => {
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
    return payrollEligibleEmployees.map(emp => {
      const days = employeeDays[emp.id] ?? 30;
      const dailyRate = Number(emp.salary) / 30;
      const grossPay = dailyRate * days;
      return { ...emp, daysWorked: days, dailyRate, grossPay };
    });
  };

  const previewTotal = calculatePayrollPreview().reduce((sum, emp) => sum + emp.grossPay, 0);

  const startEditMode = () => {
    const daysMap: Record<string, number> = {};
    const lopMap: Record<string, number> = {};
    const advanceMap: Record<string, number> = {};
    payrollItems.forEach(item => {
      daysMap[item.id] = item.daysWorked;
      lopMap[item.id] = (item as any).lossOfPayDays || 0;
      advanceMap[item.id] = Number((item as any).salaryAdvance || 0);
    });
    setEditedDays(daysMap);
    setEditedLopDays(lopMap);
    setEditedAdvance(advanceMap);
    setIsEditMode(true);
  };

  const cancelEditMode = () => {
    setIsEditMode(false);
    setEditedDays({});
    setEditedLopDays({});
    setEditedAdvance({});
  };

  const savePayrollChanges = () => {
    if (!selectedRun) return;
    const items = payrollItems.map(item => ({
      id: item.id,
      daysWorked: editedDays[item.id] ?? item.daysWorked,
      lossOfPayDays: editedLopDays[item.id] ?? (item as any).lossOfPayDays ?? 0,
      salaryAdvance: editedAdvance[item.id] ?? Number((item as any).salaryAdvance || 0),
    }));
    updatePayrollMutation.mutate({ runId: selectedRun.id, items });
  };

  const downloadExcel = async () => {
    if (!selectedRun || payrollItems.length === 0) return;

    const XLSX = await import('xlsx');

    const data = payrollItems.map(item => ({
      'Employee Name': item.employeeName,
      'Monthly Salary': Number(item.monthlySalary),
      'Days Worked': item.daysWorked,
      'Daily Rate': Number(item.dailyRate),
      'Gross Pay': Number(item.grossPay),
      'Deductions': Number(item.deductions),
      'Net Pay': Number(item.netPay),
    }));

    data.push({
      'Employee Name': 'TOTAL',
      'Monthly Salary': payrollItems.reduce((sum, i) => sum + Number(i.monthlySalary), 0),
      'Days Worked': 0,
      'Daily Rate': 0,
      'Gross Pay': payrollItems.reduce((sum, i) => sum + Number(i.grossPay), 0),
      'Deductions': payrollItems.reduce((sum, i) => sum + Number(i.deductions), 0),
      'Net Pay': Number(selectedRun.totalAmount),
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Payroll');

    ws['!cols'] = [
      { wch: 25 },
      { wch: 15 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
    ];

    XLSX.writeFile(wb, `Payroll_${monthNames[selectedRun.month - 1]}_${selectedRun.year}.xlsx`);
    toast({ title: 'Excel downloaded successfully' });
  };

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
                <div className="flex flex-wrap gap-2">
                  {isEditMode ? (
                    <>
                      <Button 
                        size="sm" 
                        onClick={savePayrollChanges}
                        disabled={updatePayrollMutation.isPending}
                        data-testid="button-save-payroll"
                      >
                        <Save className="h-4 w-4 mr-1" /> {updatePayrollMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={cancelEditMode}
                        data-testid="button-cancel-edit"
                      >
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={downloadExcel}
                        data-testid="button-download-excel"
                      >
                        <Download className="h-4 w-4 mr-1" /> Excel
                      </Button>
                      {selectedRun.status === 'draft' && isAdmin && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => syncEmployeesMutation.mutate(selectedRun.id)}
                            disabled={syncEmployeesMutation.isPending}
                            data-testid="button-sync-employees"
                          >
                            <RefreshCw className={cn("h-4 w-4 mr-1", syncEmployeesMutation.isPending && "animate-spin")} /> 
                            {syncEmployeesMutation.isPending ? 'Syncing...' : 'Sync Employees'}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={startEditMode}
                            data-testid="button-edit-payroll"
                          >
                            <Pencil className="h-4 w-4 mr-1" /> Edit
                          </Button>
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
                    </>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="px-4 sm:px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Employee</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">Monthly Salary</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">Days Worked</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">LOP Days</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">Advance</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">Deductions</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">Net Pay</TableHead>
                        <TableHead className="text-center text-xs sm:text-sm">Status</TableHead>
                        {isSuperAdmin && (
                          <TableHead className="text-right text-xs sm:text-sm w-20">Actions</TableHead>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollItems.map(item => {
                        const daysWorked = isEditMode ? (editedDays[item.id] ?? item.daysWorked) : item.daysWorked;
                        const lopDays = isEditMode ? (editedLopDays[item.id] ?? (item as any).lossOfPayDays ?? 0) : ((item as any).lossOfPayDays ?? 0);
                        const advance = isEditMode ? (editedAdvance[item.id] ?? Number((item as any).salaryAdvance || 0)) : Number((item as any).salaryAdvance || 0);
                        const dailyRate = Number(item.monthlySalary) / 30;
                        const lopDeduction = dailyRate * lopDays;
                        const totalDeductions = lopDeduction + advance;
                        const grossPay = dailyRate * daysWorked;
                        const calculatedPay = isEditMode ? (grossPay - totalDeductions) : Number(item.netPay);
                        return (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs sm:text-sm font-medium">{item.employeeName}</TableCell>
                            <TableCell className="text-right font-mono text-xs sm:text-sm">
                              ₹{Number(item.monthlySalary).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              {isEditMode ? (
                                <Input
                                  type="number"
                                  min="0"
                                  max="31"
                                  value={editedDays[item.id] ?? item.daysWorked}
                                  onChange={e => setEditedDays(prev => ({
                                    ...prev,
                                    [item.id]: Math.min(31, Math.max(0, Number(e.target.value)))
                                  }))}
                                  className="w-16 text-center text-xs sm:text-sm ml-auto"
                                  data-testid={`input-edit-days-${item.id}`}
                                />
                              ) : (
                                daysWorked
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              {isEditMode ? (
                                <Input
                                  type="number"
                                  min="0"
                                  max="31"
                                  value={editedLopDays[item.id] ?? (item as any).lossOfPayDays ?? 0}
                                  onChange={e => setEditedLopDays(prev => ({
                                    ...prev,
                                    [item.id]: Math.min(31, Math.max(0, Number(e.target.value)))
                                  }))}
                                  className="w-16 text-center text-xs sm:text-sm ml-auto"
                                  data-testid={`input-edit-lop-${item.id}`}
                                />
                              ) : (
                                lopDays > 0 ? lopDays : '-'
                              )}
                            </TableCell>
                            <TableCell className="text-right text-xs sm:text-sm">
                              {isEditMode ? (
                                <Input
                                  type="number"
                                  min="0"
                                  value={editedAdvance[item.id] ?? Number((item as any).salaryAdvance || 0)}
                                  onChange={e => setEditedAdvance(prev => ({
                                    ...prev,
                                    [item.id]: Math.max(0, Number(e.target.value))
                                  }))}
                                  className="w-20 text-center text-xs sm:text-sm ml-auto"
                                  data-testid={`input-edit-advance-${item.id}`}
                                />
                              ) : (
                                advance > 0 ? `₹${advance.toLocaleString()}` : '-'
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs sm:text-sm text-red-600">
                              {totalDeductions > 0 ? `₹${totalDeductions.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs sm:text-sm font-bold">
                              ₹{calculatedPay.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-center">
                              {(item as any).isPaid ? (
                                <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                                  <Check className="h-3 w-3" /> Paid
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-full">
                                  <Clock className="h-3 w-3" /> Pending
                                </span>
                              )}
                            </TableCell>
                            {isSuperAdmin && (
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {!(item as any).isPaid && (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs text-green-600 hover:text-green-700 hover:bg-green-50"
                                      onClick={async () => {
                                        if (confirm(`Mark ${item.employeeName}'s salary as paid and add to daybook?`)) {
                                          try {
                                            const response = await fetch(`/api/payroll-items/${item.id}/mark-paid`, { 
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              credentials: 'include',
                                              body: JSON.stringify({})
                                            });
                                            if (!response.ok) {
                                              const error = await response.json();
                                              throw new Error(error.error || 'Failed to mark as paid');
                                            }
                                            queryClient.invalidateQueries({ queryKey: ['/api/payroll-runs'] });
                                            queryClient.invalidateQueries({ queryKey: ['/api/payroll-runs', selectedRun.id, 'items'] });
                                            queryClient.invalidateQueries({ queryKey: ['/api/daybook'] });
                                            toast({ title: `${item.employeeName} marked as paid` });
                                          } catch (error: any) {
                                            toast({ title: error.message || 'Failed to mark as paid', variant: 'destructive' });
                                          }
                                        }
                                      }}
                                      data-testid={`button-mark-paid-${item.id}`}
                                    >
                                      <DollarSign className="h-3 w-3 mr-1" /> Pay
                                    </Button>
                                  )}
                                  {selectedRun?.status !== 'paid' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                      onClick={async () => {
                                        if (confirm(`Remove ${item.employeeName} from this payroll?`)) {
                                          try {
                                            const response = await fetch(`/api/payroll-items/${item.id}`, { 
                                              method: 'DELETE',
                                              credentials: 'include'
                                            });
                                            if (!response.ok) {
                                              const error = await response.json();
                                              throw new Error(error.error || 'Failed to delete');
                                            }
                                            queryClient.invalidateQueries({ queryKey: ['/api/payroll-runs'] });
                                            queryClient.invalidateQueries({ queryKey: ['/api/payroll-runs', selectedRun.id, 'items'] });
                                            toast({ title: 'Employee removed from payroll' });
                                          } catch (error: any) {
                                            toast({ title: error.message || 'Failed to remove employee', variant: 'destructive' });
                                          }
                                        }
                                      }}
                                      data-testid={`button-delete-payroll-item-${item.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        );
                      })}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={6} className="text-xs sm:text-sm">Total Payroll</TableCell>
                        <TableCell className="text-right text-primary font-mono text-xs sm:text-sm">
                          {isEditMode ? (
                            `₹${payrollItems.reduce((sum, item) => {
                              const days = editedDays[item.id] ?? item.daysWorked;
                              const dailyRate = Number(item.monthlySalary) / 30;
                              return sum + (dailyRate * days);
                            }, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                          ) : (
                            `₹${Number(selectedRun.totalAmount).toLocaleString()}`
                          )}
                        </TableCell>
                        <TableCell className="text-center text-xs">
                          {payrollItems.filter(i => (i as any).isPaid).length}/{payrollItems.length} paid
                        </TableCell>
                        {isSuperAdmin && <TableCell />}
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
              {isAdmin && payrollEligibleEmployees.length > 0 && (
                <Button onClick={openCreateDialog} data-testid="button-create-payroll">
                  <Plus className="h-4 w-4 mr-2" /> Create Payroll
                </Button>
              )}
              {payrollEligibleEmployees.length === 0 && (
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
            <div className="px-4 sm:px-0">
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
                        value={employeeDays[emp.id] ?? 30}
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

// Salary Slips Section
interface SalarySlip {
  id: string;
  payrollRunId: string;
  payrollItemId: string;
  employeeId: string;
  month: number;
  year: number;
  employeeName: string;
  designation: string | null;
  department: string | null;
  panNumber: string | null;
  location: string | null;
  joinDate: string | null;
  totalDays: number;
  daysPresent: number;
  daysPaid: number;
  basicPay: string;
  basicDa: string;
  hra: string | null;
  otherAllowances: string | null;
  transportationAllowance: string | null;
  totalEarnings: string;
  professionalTax: string | null;
  lossOfPay: string | null;
  transportDeduction: string | null;
  totalDeductions: string;
  netPayment: string;
  amountInWords: string | null;
  sentViaWhatsapp: boolean;
  sentAt: string | null;
  createdAt: string;
}

function SalarySlipsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  const [selectedPayrollId, setSelectedPayrollId] = useState<string>('');
  const [payrollOpen, setPayrollOpen] = useState(false);
  const [payrollSearch, setPayrollSearch] = useState('');
  const [sendingSlipId, setSendingSlipId] = useState<string | null>(null);
  
  const { data: payrollRuns = [] } = useQuery<PayrollRun[]>({
    queryKey: ['/api/payroll-runs'],
    queryFn: async () => {
      const res = await fetch('/api/payroll-runs', {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch payroll runs');
      return res.json();
    },
  });
  
  const { data: salarySlips = [], isLoading: slipsLoading, refetch: refetchSlips } = useQuery<SalarySlip[]>({
    queryKey: ['/api/salary-slips/payroll', selectedPayrollId],
    queryFn: async () => {
      if (!selectedPayrollId) return [];
      const res = await fetch(`/api/salary-slips/payroll/${selectedPayrollId}`);
      if (!res.ok) throw new Error('Failed to fetch salary slips');
      return res.json();
    },
    enabled: !!selectedPayrollId,
  });
  
  const generateSlipsMutation = useMutation({
    mutationFn: async (runId: string) => {
      const res = await fetch(`/api/salary-slips/generate/${runId}`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to generate salary slips');
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: `Generated ${data.count} salary slips` });
      refetchSlips();
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const sendWhatsAppMutation = useMutation({
    mutationFn: async (slipId: string) => {
      setSendingSlipId(slipId);
      const res = await fetch(`/api/salary-slips/${slipId}/send-whatsapp`, { 
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send WhatsApp');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Salary slip sent via WhatsApp' });
      refetchSlips();
      setSendingSlipId(null);
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setSendingSlipId(null);
    },
  });
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  const filteredPayrollRuns = payrollRuns.filter(run => {
    const label = `${monthNames[run.month - 1]} ${run.year}`;
    return label.toLowerCase().includes(payrollSearch.toLowerCase());
  });
  
  const selectedRun = payrollRuns.find(r => r.id === selectedPayrollId);
  
  const downloadPDF = (slip: SalarySlip) => {
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Add Yepman logo on left side (in color on white background)
      const img = new Image();
      img.src = yepmanLogo;
      try {
        doc.addImage(img, 'PNG', 15, 8, 30, 30);
      } catch (e) {
        // Logo loading failed, continue without it
      }
      
      // Header text - normal black text on white background
      doc.setTextColor(157, 41, 102); // Maroon color for company name
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('YEPMAN INTERNATIONAL', pageWidth / 2 + 15, 18, { align: 'center' });
      
      doc.setTextColor(0, 0, 0); // Black for address
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('2nd Floor, Above Devas Studio, Kaloor, Kochi-682017', pageWidth / 2 + 15, 26, { align: 'center' });
      doc.text('Tel: 7902373354', pageWidth / 2 + 15, 33, { align: 'center' });
      
      // Title
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('PAY SLIP', pageWidth / 2, 45, { align: 'center' });
      
      const monthLabel = `${monthNames[slip.month - 1]} ${slip.year}`;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`For the month of ${monthLabel}`, pageWidth / 2, 52, { align: 'center' });
      
      // Employee details box
      doc.setDrawColor(157, 41, 102);
      doc.setLineWidth(0.5);
      doc.rect(15, 58, pageWidth - 30, 30);
      
      doc.setFontSize(9);
      doc.text(`Employee Name: ${slip.employeeName}`, 20, 66);
      doc.text(`Designation: ${slip.designation || '-'}`, 20, 73);
      doc.text(`Department: ${slip.department || '-'}`, 20, 80);
      doc.text(`Location: ${slip.location || 'KOCHI'}`, 110, 66);
      doc.text(`PAN: ${slip.panNumber || '-'}`, 110, 73);
      doc.text(`Join Date: ${slip.joinDate || '-'}`, 110, 80);
      
      // Attendance section
      doc.setFillColor(157, 41, 102);
      doc.rect(15, 95, pageWidth - 30, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('ATTENDANCE', pageWidth / 2, 101, { align: 'center' });
      
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.rect(15, 103, pageWidth - 30, 15);
      doc.text(`Total Days: ${slip.totalDays}`, 25, 112);
      doc.text(`Days Present: ${slip.daysPresent}`, 75, 112);
      doc.text(`Days Paid: ${slip.daysPaid}`, 130, 112);
      
      // Earnings section
      let y = 125;
      doc.setFillColor(157, 41, 102);
      doc.rect(15, y, (pageWidth - 30) / 2, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('EARNINGS', 60, y + 6, { align: 'center' });
      
      // Deductions header
      doc.setFillColor(157, 41, 102);
      doc.rect(15 + (pageWidth - 30) / 2, y, (pageWidth - 30) / 2, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text('DEDUCTIONS', 150, y + 6, { align: 'center' });
      
      y += 8;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      
      // Earnings details
      doc.rect(15, y, (pageWidth - 30) / 2, 45);
      doc.text('Basic + DA:', 20, y + 8);
      doc.text(slip.basicDa, 80, y + 8, { align: 'right' });
      doc.text('HRA:', 20, y + 16);
      doc.text(slip.hra || '0.00', 80, y + 16, { align: 'right' });
      doc.text('Other Allowances:', 20, y + 24);
      doc.text(slip.otherAllowances || '0.00', 80, y + 24, { align: 'right' });
      doc.text('Transportation:', 20, y + 32);
      doc.text(slip.transportationAllowance || '0.00', 80, y + 32, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text('Total Earnings:', 20, y + 40);
      doc.text(slip.totalEarnings, 80, y + 40, { align: 'right' });
      
      // Deductions details
      doc.setFont('helvetica', 'normal');
      doc.rect(15 + (pageWidth - 30) / 2, y, (pageWidth - 30) / 2, 45);
      const lossOfPayAmount = parseFloat(slip.lossOfPay || '0');
      const salaryAdvanceAmount = parseFloat((slip as any).salaryAdvance || '0');
      const transportDeductionAmount = parseFloat(slip.transportDeduction || '0');
      const calculatedTotalDeductions = lossOfPayAmount + salaryAdvanceAmount + transportDeductionAmount;
      
      doc.text('Loss of Pay:', 110, y + 8);
      doc.text(lossOfPayAmount.toFixed(2), 180, y + 8, { align: 'right' });
      doc.text('Salary Advance:', 110, y + 16);
      doc.text(salaryAdvanceAmount.toFixed(2), 180, y + 16, { align: 'right' });
      doc.text('Transport Deduction:', 110, y + 24);
      doc.text(transportDeductionAmount.toFixed(2), 180, y + 24, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text('Total Deductions:', 110, y + 40);
      doc.text(calculatedTotalDeductions.toFixed(2), 180, y + 40, { align: 'right' });
      
      // Net Payment section
      y += 52;
      doc.setFillColor(157, 41, 102);
      doc.rect(15, y, pageWidth - 30, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text('NET PAYMENT:', 20, y + 8);
      doc.text(`Rs. ${slip.netPayment}`, pageWidth - 20, y + 8, { align: 'right' });
      
      // Amount in words
      y += 18;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text(`(${slip.amountInWords || ''})`, pageWidth / 2, y, { align: 'center' });
      
      // Signature section
      y += 25;
      doc.setFont('helvetica', 'normal');
      doc.line(15, y, 70, y);
      doc.line(pageWidth - 70, y, pageWidth - 15, y);
      doc.text("Employee's Signature", 42.5, y + 8, { align: 'center' });
      doc.text("For Yepman International", pageWidth - 42.5, y + 8, { align: 'center' });
      
      // Footer
      y += 25;
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('This is a computer generated document.', pageWidth / 2, y, { align: 'center' });
      
      doc.save(`Salary_Slip_${slip.employeeName.replace(/\s+/g, '_')}_${monthNames[slip.month - 1]}_${slip.year}.pdf`);
    });
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-lg font-serif flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Salary Slips
          </CardTitle>
          <div className="flex items-center gap-2">
            <Popover open={payrollOpen} onOpenChange={setPayrollOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-[200px] justify-between">
                  {selectedRun
                    ? `${monthNames[selectedRun.month - 1]} ${selectedRun.year}`
                    : "Select payroll..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0">
                <Command>
                  <CommandInput placeholder="Search payroll..." value={payrollSearch} onValueChange={setPayrollSearch} />
                  <CommandList>
                    <CommandEmpty>No payroll found.</CommandEmpty>
                    <CommandGroup>
                      {filteredPayrollRuns.map((run) => (
                        <CommandItem
                          key={run.id}
                          onSelect={() => {
                            setSelectedPayrollId(run.id);
                            setPayrollOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedPayrollId === run.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {monthNames[run.month - 1]} {run.year}
                          <Badge variant={run.status === 'paid' ? 'default' : 'secondary'} className="ml-auto">
                            {run.status}
                          </Badge>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            
            {selectedPayrollId && (
              <Button
                onClick={() => generateSlipsMutation.mutate(selectedPayrollId)}
                disabled={generateSlipsMutation.isPending}
                variant="outline"
              >
                {generateSlipsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Receipt className="h-4 w-4 mr-2" />
                )}
                Generate Slips
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!selectedPayrollId ? (
          <div className="text-center py-8 text-muted-foreground">
            Select a payroll to view or generate salary slips
          </div>
        ) : slipsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : salarySlips.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No salary slips found for this payroll.</p>
            <p className="text-sm">Click "Generate Slips" to create salary slips for all employees.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Designation</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Net Payment</TableHead>
                <TableHead className="text-center">WhatsApp</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salarySlips.map((slip) => (
                <TableRow key={slip.id}>
                  <TableCell className="font-medium">{slip.employeeName}</TableCell>
                  <TableCell>{slip.designation || '-'}</TableCell>
                  <TableCell>{slip.department || '-'}</TableCell>
                  <TableCell className="text-right font-medium">
                    Rs. {parseFloat(slip.netPayment).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-center">
                    {slip.sentViaWhatsapp ? (
                      <Badge variant="default" className="bg-green-600">
                        <Check className="h-3 w-3 mr-1" />
                        Sent
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Pending</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadPDF(slip)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                      {isSuperAdmin && (
                        <Button
                          size="sm"
                          variant={slip.sentViaWhatsapp ? "outline" : "default"}
                          className={slip.sentViaWhatsapp ? "" : "bg-green-600 hover:bg-green-700"}
                          onClick={() => sendWhatsAppMutation.mutate(slip.id)}
                          disabled={sendingSlipId === slip.id}
                        >
                          {sendingSlipId === slip.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-1" />
                              {slip.sentViaWhatsapp ? "Resend" : "Send"}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

interface PendingRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  type: 'leave' | 'advance' | 'expense';
  status: string;
  createdAt: string;
  startDate?: string;
  endDate?: string;
  leaveType?: string;
  reason?: string;
  amount?: string;
  repaymentMonths?: number;
  expenseDate?: string;
  category?: string;
  description?: string;
}

function ManagerApprovalsSection({ isAdmin, approvalTab, setApprovalTab }: { isAdmin: boolean; approvalTab: string; setApprovalTab: (tab: string) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<PendingRequest | null>(null);
  const [approvalComments, setApprovalComments] = useState('');
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [isQuickEntryDialogOpen, setIsQuickEntryDialogOpen] = useState(false);
  const [selectedQuickEntry, setSelectedQuickEntry] = useState<any>(null);
  const [quickEntryEventId, setQuickEntryEventId] = useState<string>('');
  const [quickEntryCategoryId, setQuickEntryCategoryId] = useState<string>('');
  const [quickEntryBankId, setQuickEntryBankId] = useState<string>('');
  const [quickEntryNotes, setQuickEntryNotes] = useState('');
  const [isDaybookDialogOpen, setIsDaybookDialogOpen] = useState(false);
  const [selectedExpenseForDaybook, setSelectedExpenseForDaybook] = useState<any>(null);
  const [daybookEventId, setDaybookEventId] = useState<string>('');
  const [daybookCategory, setDaybookCategory] = useState<string>('');
  const [daybookBankId, setDaybookBankId] = useState<string>('');
  const [daybookEventSearch, setDaybookEventSearch] = useState('');
  const [daybookEventOpen, setDaybookEventOpen] = useState(false);
  const [isEditQuickEntryDialogOpen, setIsEditQuickEntryDialogOpen] = useState(false);
  const [editingQuickEntry, setEditingQuickEntry] = useState<any>(null);
  const [editQuickEntryForm, setEditQuickEntryForm] = useState({
    amount: '',
    direction: 'paid' as 'paid' | 'received',
    counterpartyName: '',
    notes: '',
    employeeId: '',
    eventId: ''
  });
  const [editEventSearch, setEditEventSearch] = useState('');
  const [editEventOpen, setEditEventOpen] = useState(false);

  const { data: events = [] } = useQuery<any[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await fetch('/api/events');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: banks = [] } = useQuery<any[]>({
    queryKey: ['/api/banks'],
    queryFn: async () => {
      const res = await fetch('/api/banks');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: approvedPayouts = [] } = useQuery<any[]>({
    queryKey: ['/api/admin/approved-payouts'],
    queryFn: async () => {
      const res = await fetch('/api/admin/approved-payouts', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const { data: pendingLeaves = [] } = useQuery<any[]>({
    queryKey: ['/api/manager/pending-leaves'],
    queryFn: async () => {
      const res = await fetch('/api/manager/pending-leaves', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 30000,
  });

  const { data: pendingAdvances = [] } = useQuery<any[]>({
    queryKey: ['/api/manager/pending-advances'],
    queryFn: async () => {
      const res = await fetch('/api/manager/pending-advances', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: pendingExpenses = [] } = useQuery<any[]>({
    queryKey: ['/api/manager/pending-expenses'],
    queryFn: async () => {
      const res = await fetch('/api/manager/pending-expenses', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: pendingQuickEntries = [] } = useQuery<any[]>({
    queryKey: ['/api/hr/quick-entries/pending'],
    queryFn: async () => {
      const res = await fetch('/api/hr/quick-entries/pending');
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isAdmin,
  });

  const approveLeave = useMutation({
    mutationFn: async ({ id, comments }: { id: string; comments: string }) => {
      const res = await fetch(`/api/manager/leaves/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments }),
      });
      if (!res.ok) throw new Error('Failed to approve');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manager/pending-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['/api/leave-requests'] });
      toast({ title: 'Leave request approved' });
      setIsApprovalDialogOpen(false);
      setSelectedRequest(null);
      setApprovalComments('');
    },
  });

  const rejectLeave = useMutation({
    mutationFn: async ({ id, comments }: { id: string; comments: string }) => {
      const res = await fetch(`/api/manager/leaves/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments }),
      });
      if (!res.ok) throw new Error('Failed to reject');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manager/pending-leaves'] });
      queryClient.invalidateQueries({ queryKey: ['/api/leave-requests'] });
      toast({ title: 'Leave request rejected' });
      setIsApprovalDialogOpen(false);
      setSelectedRequest(null);
      setApprovalComments('');
    },
  });

  const approveAdvance = useMutation({
    mutationFn: async ({ id, comments }: { id: string; comments: string }) => {
      const res = await fetch(`/api/manager/advances/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments }),
      });
      if (!res.ok) throw new Error('Failed to approve');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manager/pending-advances'] });
      toast({ title: 'Advance request approved' });
      setIsApprovalDialogOpen(false);
      setSelectedRequest(null);
      setApprovalComments('');
    },
  });

  const rejectAdvance = useMutation({
    mutationFn: async ({ id, comments }: { id: string; comments: string }) => {
      const res = await fetch(`/api/manager/advances/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments }),
      });
      if (!res.ok) throw new Error('Failed to reject');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manager/pending-advances'] });
      toast({ title: 'Advance request rejected' });
      setIsApprovalDialogOpen(false);
      setSelectedRequest(null);
      setApprovalComments('');
    },
  });

  const approveExpense = useMutation({
    mutationFn: async ({ id, comments }: { id: string; comments: string }) => {
      const res = await fetch(`/api/manager/expenses/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments }),
      });
      if (!res.ok) throw new Error('Failed to approve');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manager/pending-expenses'] });
      toast({ title: 'Expense reimbursement approved' });
      setIsApprovalDialogOpen(false);
      setSelectedRequest(null);
      setApprovalComments('');
    },
  });

  const rejectExpense = useMutation({
    mutationFn: async ({ id, comments }: { id: string; comments: string }) => {
      const res = await fetch(`/api/manager/expenses/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments }),
      });
      if (!res.ok) throw new Error('Failed to reject');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/manager/pending-expenses'] });
      toast({ title: 'Expense reimbursement rejected' });
      setIsApprovalDialogOpen(false);
      setSelectedRequest(null);
      setApprovalComments('');
    },
  });

  const pushToDaybook = useMutation({
    mutationFn: async ({ id, type, eventId, category, bankId }: { id: string; type: string; eventId?: string; category?: string; bankId?: string }) => {
      const res = await fetch(`/api/admin/approved-payouts/${id}/push-to-daybook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, eventId, category, bankId }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to push to daybook');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/approved-payouts'] });
      queryClient.invalidateQueries({ queryKey: ['/api/daybook'] });
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
      toast({ title: 'Pushed to daybook successfully' });
      setIsDaybookDialogOpen(false);
      setSelectedExpenseForDaybook(null);
      setDaybookEventId('');
      setDaybookCategory('');
      setDaybookBankId('');
    },
    onError: () => {
      toast({ title: 'Failed to push to daybook', variant: 'destructive' });
    },
  });

  const handlePushToDaybook = (payout: any) => {
    setSelectedExpenseForDaybook(payout);
    setDaybookCategory(payout.category || '');
    setDaybookEventId('');
    setDaybookBankId('');
    setIsDaybookDialogOpen(true);
  };

  const confirmPushToDaybook = () => {
    if (!selectedExpenseForDaybook) return;
    pushToDaybook.mutate({
      id: selectedExpenseForDaybook.id,
      type: selectedExpenseForDaybook.type,
      eventId: daybookEventId || undefined,
      category: daybookCategory || undefined,
      bankId: daybookBankId || undefined,
    });
  };

  const handleApprovalAction = (request: any, type: 'leave' | 'advance' | 'expense', action: 'approve' | 'reject') => {
    setSelectedRequest({ ...request, type });
    setApprovalAction(action);
    setApprovalComments('');
    setIsApprovalDialogOpen(true);
  };

  const quickEntryApprove = useMutation({
    mutationFn: async ({ id, eventId, categoryId, bankId, notes }: { id: string; eventId?: string; categoryId?: string; bankId?: string; notes?: string }) => {
      const res = await fetch(`/api/hr/quick-entries/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ eventId, categoryId, bankId, notes }),
      });
      if (!res.ok) throw new Error('Failed to approve quick entry');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hr/quick-entries/pending'] });
      setIsQuickEntryDialogOpen(false);
      setSelectedQuickEntry(null);
      setQuickEntryEventId('');
      setQuickEntryCategoryId('');
      setQuickEntryBankId('');
      setQuickEntryNotes('');
      toast({ title: 'Success', description: 'Quick entry approved and added to daybook' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const quickEntryReject = useMutation({
    mutationFn: async ({ id, reviewerNotes }: { id: string; reviewerNotes?: string }) => {
      const res = await fetch(`/api/hr/quick-entries/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reviewerNotes }),
      });
      if (!res.ok) throw new Error('Failed to reject quick entry');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hr/quick-entries/pending'] });
      toast({ title: 'Success', description: 'Quick entry rejected' });
    },
    onError: (error: Error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const handleQuickEntryAction = (entry: any, action: 'approve' | 'reject') => {
    if (action === 'approve') {
      setSelectedQuickEntry(entry);
      setIsQuickEntryDialogOpen(true);
    } else {
      quickEntryReject.mutate({ id: entry.id });
    }
  };

  const confirmQuickEntryApproval = () => {
    if (!selectedQuickEntry) return;
    quickEntryApprove.mutate({
      id: selectedQuickEntry.id,
      eventId: quickEntryEventId || undefined,
      categoryId: quickEntryCategoryId || undefined,
      bankId: quickEntryBankId || undefined,
      notes: quickEntryNotes || undefined,
    });
  };

  const openEditQuickEntry = (entry: any) => {
    setEditingQuickEntry(entry);
    setEditQuickEntryForm({
      amount: entry.amount || '',
      direction: entry.direction || 'paid',
      counterpartyName: entry.counterpartyName || '',
      notes: entry.notes || '',
      employeeId: entry.employeeId || '',
      eventId: entry.eventId || ''
    });
    setEditEventSearch('');
    setIsEditQuickEntryDialogOpen(true);
  };

  const updateQuickEntryMutation = useMutation({
    mutationFn: async (data: { id: string; updates: any }) => {
      const res = await fetch(`/api/employee-portal/quick-entries/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data.updates),
      });
      if (!res.ok) throw new Error('Failed to update quick entry');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hr/quick-entries/pending'] });
      setIsEditQuickEntryDialogOpen(false);
      toast({ title: 'Quick entry updated successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to update quick entry', variant: 'destructive' });
    }
  });

  const deleteQuickEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employee-portal/quick-entries/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete quick entry');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hr/quick-entries/pending'] });
      toast({ title: 'Quick entry deleted successfully' });
    },
    onError: () => {
      toast({ title: 'Failed to delete quick entry', variant: 'destructive' });
    }
  });

  const handleSaveQuickEntry = () => {
    if (!editingQuickEntry) return;
    updateQuickEntryMutation.mutate({
      id: editingQuickEntry.id,
      updates: {
        amount: editQuickEntryForm.amount,
        direction: editQuickEntryForm.direction,
        counterpartyName: editQuickEntryForm.counterpartyName,
        notes: editQuickEntryForm.notes,
        employeeId: editQuickEntryForm.employeeId,
        eventId: editQuickEntryForm.eventId || null
      }
    });
  };

  const confirmApproval = () => {
    if (!selectedRequest) return;
    
    const { id, type } = selectedRequest;
    const comments = approvalComments;

    if (type === 'leave') {
      if (approvalAction === 'approve') {
        approveLeave.mutate({ id, comments });
      } else {
        rejectLeave.mutate({ id, comments });
      }
    } else if (type === 'advance') {
      if (approvalAction === 'approve') {
        approveAdvance.mutate({ id, comments });
      } else {
        rejectAdvance.mutate({ id, comments });
      }
    } else if (type === 'expense') {
      if (approvalAction === 'approve') {
        approveExpense.mutate({ id, comments });
      } else {
        rejectExpense.mutate({ id, comments });
      }
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    try {
      return format(parseISO(dateString), 'dd MMM yyyy');
    } catch {
      return dateString;
    }
  };

  const totalPending = pendingLeaves.length + pendingAdvances.length + pendingExpenses.length;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:gap-4 grid-cols-3">
        <Card>
          <CardHeader className="p-3 pb-1 sm:pb-2 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
              <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-blue-500" />
              <span className="hidden sm:inline">Pending</span> Leaves
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{pendingLeaves.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1 sm:pb-2 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
              <Banknote className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
              Advances
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{pendingAdvances.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-3 pb-1 sm:pb-2 sm:p-6">
            <CardTitle className="text-xs sm:text-sm font-medium flex items-center gap-1 sm:gap-2">
              <Receipt className="h-3 w-3 sm:h-4 sm:w-4 text-orange-500" />
              Expenses
            </CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{pendingExpenses.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={approvalTab} onValueChange={setApprovalTab} className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="leaves" className="text-xs sm:text-sm">
            Leave Requests ({pendingLeaves.length})
          </TabsTrigger>
          <TabsTrigger value="advances" className="text-xs sm:text-sm">
            Salary Advances ({pendingAdvances.length})
          </TabsTrigger>
          <TabsTrigger value="expenses" className="text-xs sm:text-sm">
            Expenses ({pendingExpenses.length})
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="quick-entries" className="text-xs sm:text-sm">
              Quick Entries ({pendingQuickEntries.length})
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="approved-payouts" className="text-xs sm:text-sm">
              Approved Payouts ({approvedPayouts.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="leaves">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Pending Leave Requests
              </CardTitle>
              <CardDescription>Review and approve leave requests from your team</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {/* Mobile Card View */}
              <div className="md:hidden divide-y">
                {pendingLeaves.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">No pending leave requests</div>
                ) : (
                  pendingLeaves.map((leave: any) => (
                    <div key={leave.id} className="py-3 space-y-2" data-testid={`card-leave-${leave.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{leave.employeeName || 'Employee'}</p>
                          <p className="text-xs text-muted-foreground capitalize">{leave.leaveType}</p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">{formatDate(leave.startDate)} - {formatDate(leave.endDate)}</Badge>
                      </div>
                      {leave.reason && <p className="text-xs text-muted-foreground truncate">{leave.reason}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 text-green-600 h-8 text-xs" onClick={() => handleApprovalAction(leave, 'leave', 'approve')}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 text-red-600 h-8 text-xs" onClick={() => handleApprovalAction(leave, 'leave', 'reject')}>
                          <XCircle className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>From</TableHead>
                      <TableHead>To</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingLeaves.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No pending leave requests
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingLeaves.map((leave: any) => (
                        <TableRow key={leave.id} data-testid={`row-pending-leave-${leave.id}`}>
                          <TableCell className="font-medium">{leave.employeeName || 'Employee'}</TableCell>
                          <TableCell className="capitalize">{leave.leaveType}</TableCell>
                          <TableCell>{formatDate(leave.startDate)}</TableCell>
                          <TableCell>{formatDate(leave.endDate)}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{leave.reason || '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700" onClick={() => handleApprovalAction(leave, 'leave', 'approve')} data-testid={`button-approve-leave-${leave.id}`}>
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => handleApprovalAction(leave, 'leave', 'reject')} data-testid={`button-reject-leave-${leave.id}`}>
                                <XCircle className="h-4 w-4 mr-1" /> Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advances">
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Banknote className="h-4 w-4 sm:h-5 sm:w-5" />
                Pending Salary Advance Requests
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Review and approve salary advance requests</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {/* Mobile Card View */}
              <div className="md:hidden divide-y">
                {pendingAdvances.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">No pending advance requests</div>
                ) : (
                  pendingAdvances.map((advance: any) => (
                    <div key={advance.id} className="py-3 space-y-2" data-testid={`card-advance-${advance.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{advance.employeeName || 'Employee'}</p>
                          <p className="text-xs text-muted-foreground">{advance.repaymentMonths} month repayment</p>
                        </div>
                        <p className="text-sm font-bold">₹{Number(advance.amount).toLocaleString()}</p>
                      </div>
                      {advance.reason && <p className="text-xs text-muted-foreground truncate">{advance.reason}</p>}
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 text-green-600 h-8 text-xs" onClick={() => handleApprovalAction(advance, 'advance', 'approve')}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 text-red-600 h-8 text-xs" onClick={() => handleApprovalAction(advance, 'advance', 'reject')}>
                          <XCircle className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Repayment</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingAdvances.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No pending advance requests
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingAdvances.map((advance: any) => (
                        <TableRow key={advance.id} data-testid={`row-pending-advance-${advance.id}`}>
                          <TableCell className="font-medium">{advance.employeeName || 'Employee'}</TableCell>
                          <TableCell>₹{Number(advance.amount).toLocaleString()}</TableCell>
                          <TableCell>{advance.repaymentMonths} month{advance.repaymentMonths > 1 ? 's' : ''}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{advance.reason || '-'}</TableCell>
                          <TableCell>{formatDate(advance.requestDate)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700" onClick={() => handleApprovalAction(advance, 'advance', 'approve')} data-testid={`button-approve-advance-${advance.id}`}>
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => handleApprovalAction(advance, 'advance', 'reject')} data-testid={`button-reject-advance-${advance.id}`}>
                                <XCircle className="h-4 w-4 mr-1" /> Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses">
          <Card>
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Receipt className="h-4 w-4 sm:h-5 sm:w-5" />
                Pending Expense Reimbursements
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Review and approve expense reimbursement requests</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6">
              {/* Mobile Card View */}
              <div className="md:hidden divide-y">
                {pendingExpenses.length === 0 ? (
                  <div className="text-center text-muted-foreground py-8">No pending expense reimbursements</div>
                ) : (
                  pendingExpenses.map((expense: any) => (
                    <div key={expense.id} className="py-3 space-y-2" data-testid={`card-expense-${expense.id}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{expense.employeeName || 'Employee'}</p>
                          <p className="text-xs text-muted-foreground capitalize">{expense.category}</p>
                        </div>
                        <p className="text-sm font-bold">₹{Number(expense.amount).toLocaleString()}</p>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{expense.description}</p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="flex-1 text-green-600 h-8 text-xs" onClick={() => handleApprovalAction(expense, 'expense', 'approve')}>
                          <CheckCircle2 className="h-3 w-3 mr-1" /> Approve
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 text-red-600 h-8 text-xs" onClick={() => handleApprovalAction(expense, 'expense', 'reject')}>
                          <XCircle className="h-3 w-3 mr-1" /> Reject
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Expense Date</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingExpenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No pending expense reimbursements
                        </TableCell>
                      </TableRow>
                    ) : (
                      pendingExpenses.map((expense: any) => (
                        <TableRow key={expense.id} data-testid={`row-pending-expense-${expense.id}`}>
                          <TableCell className="font-medium">{expense.employeeName || 'Employee'}</TableCell>
                          <TableCell className="capitalize">{expense.category}</TableCell>
                          <TableCell>₹{Number(expense.amount).toLocaleString()}</TableCell>
                          <TableCell className="max-w-[150px] truncate">{expense.description}</TableCell>
                          <TableCell>{formatDate(expense.expenseDate)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" className="text-green-600 hover:text-green-700" onClick={() => handleApprovalAction(expense, 'expense', 'approve')} data-testid={`button-approve-expense-${expense.id}`}>
                                <CheckCircle2 className="h-4 w-4 mr-1" /> Approve
                              </Button>
                              <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700" onClick={() => handleApprovalAction(expense, 'expense', 'reject')} data-testid={`button-reject-expense-${expense.id}`}>
                                <XCircle className="h-4 w-4 mr-1" /> Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isAdmin && (
          <TabsContent value="quick-entries">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  AI Quick Entries - Pending Review
                </CardTitle>
                <CardDescription>Review and approve payment screenshots submitted by employees</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Employee</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Counterparty</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendingQuickEntries.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No pending quick entries to review
                          </TableCell>
                        </TableRow>
                      ) : (
                        pendingQuickEntries.map((entry: any) => (
                          <TableRow key={entry.id} data-testid={`row-quick-entry-${entry.id}`}>
                            <TableCell className="font-medium">{entry.employeeName || 'Employee'}</TableCell>
                            <TableCell>₹{entry.amount ? Number(entry.amount).toLocaleString() : '-'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={entry.direction === 'received' ? 'text-green-600' : 'text-red-600'}>
                                {entry.direction === 'received' ? 'Received' : entry.direction === 'paid' ? 'Paid' : '-'}
                              </Badge>
                            </TableCell>
                            <TableCell>{entry.counterpartyName || '-'}</TableCell>
                            <TableCell>{entry.transactionDate ? formatDate(entry.transactionDate) : formatDate(entry.createdAt)}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditQuickEntry(entry)}
                                  data-testid={`button-edit-quick-entry-${entry.id}`}
                                >
                                  <Pencil className="h-4 w-4 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() => handleQuickEntryAction(entry, 'approve')}
                                  data-testid={`button-approve-quick-entry-${entry.id}`}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => deleteQuickEntryMutation.mutate(entry.id)}
                                  data-testid={`button-delete-quick-entry-${entry.id}`}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="approved-payouts">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Approved Payouts - Push to Daybook
                </CardTitle>
                <CardDescription>Push approved expenses and salary advances to Oak Daybook with optional event or category assignment</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Employee</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approvedPayouts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No approved payouts waiting to be pushed to daybook
                          </TableCell>
                        </TableRow>
                      ) : (
                        approvedPayouts.map((payout: any) => (
                          <TableRow key={`${payout.type}-${payout.id}`} data-testid={`row-approved-payout-${payout.id}`}>
                            <TableCell>
                              <Badge variant={payout.type === 'expense' ? 'default' : 'secondary'} className={payout.type === 'expense' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}>
                                {payout.type === 'expense' ? 'Expense' : 'Advance'}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{payout.employeeName || 'Employee'}</TableCell>
                            <TableCell className="capitalize">{payout.category}</TableCell>
                            <TableCell>₹{Number(payout.amount).toLocaleString()}</TableCell>
                            <TableCell className="max-w-[150px] truncate">{payout.description}</TableCell>
                            <TableCell>{formatDate(payout.date)}</TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                className="bg-[#7C8B5D] hover:bg-[#6a7a4d]"
                                onClick={() => handlePushToDaybook(payout)}
                                data-testid={`button-push-daybook-${payout.id}`}
                              >
                                <BookOpen className="h-4 w-4 mr-1" />
                                Push to Daybook
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approvalAction === 'approve' ? 'Approve' : 'Reject'} Request
            </DialogTitle>
            <DialogDescription>
              {approvalAction === 'approve' 
                ? 'Add optional comments for this approval' 
                : 'Please provide a reason for rejection'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Comments {approvalAction === 'reject' && '*'}</Label>
              <Textarea
                value={approvalComments}
                onChange={(e) => setApprovalComments(e.target.value)}
                placeholder={approvalAction === 'reject' ? 'Reason for rejection...' : 'Optional comments...'}
                data-testid="input-approval-comments"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApprovalDialogOpen(false)}>Cancel</Button>
            <Button
              variant={approvalAction === 'approve' ? 'default' : 'destructive'}
              onClick={confirmApproval}
              disabled={approvalAction === 'reject' && !approvalComments.trim()}
              data-testid="button-confirm-approval"
            >
              {approvalAction === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isQuickEntryDialogOpen} onOpenChange={setIsQuickEntryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Quick Entry</DialogTitle>
            <DialogDescription>
              {selectedQuickEntry && (
                <>
                  Amount: ₹{selectedQuickEntry.amount ? Number(selectedQuickEntry.amount).toLocaleString() : '0'} 
                  ({selectedQuickEntry.direction === 'received' ? 'Received' : 'Paid'})
                  {selectedQuickEntry.counterpartyName && ` - ${selectedQuickEntry.counterpartyName}`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Event (Optional)</Label>
              <Select value={quickEntryEventId} onValueChange={setQuickEntryEventId}>
                <SelectTrigger data-testid="select-quick-entry-event">
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {events.map((event: any) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category *</Label>
              <Input
                value={quickEntryCategoryId}
                onChange={(e) => setQuickEntryCategoryId(e.target.value)}
                placeholder="e.g., Travel, Food, Supplies"
                data-testid="input-quick-entry-category"
              />
              <p className="text-xs text-muted-foreground">Required for daybook entry</p>
            </div>
            <div className="space-y-2">
              <Label>Bank Account (Optional)</Label>
              <Select value={quickEntryBankId} onValueChange={setQuickEntryBankId}>
                <SelectTrigger data-testid="select-quick-entry-bank">
                  <SelectValue placeholder="Select bank" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {banks.map((bank: any) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={quickEntryNotes}
                onChange={(e) => setQuickEntryNotes(e.target.value)}
                placeholder="Additional notes for daybook entry"
                data-testid="input-quick-entry-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickEntryDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={confirmQuickEntryApproval} 
              disabled={!quickEntryCategoryId.trim()}
              data-testid="button-confirm-quick-entry"
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Approve & Add to Daybook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDaybookDialogOpen} onOpenChange={setIsDaybookDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Push to Oak Daybook</DialogTitle>
            <DialogDescription>
              {selectedExpenseForDaybook && (
                <>
                  Expense: ₹{Number(selectedExpenseForDaybook.amount).toLocaleString()} - {selectedExpenseForDaybook.description}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Link to Event (Optional)</Label>
              <Popover open={daybookEventOpen} onOpenChange={setDaybookEventOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={daybookEventOpen} className="w-full justify-between" data-testid="select-daybook-event">
                    {daybookEventId ? events.find((e: any) => e.id === daybookEventId)?.title || 'Select event...' : 'Select event (optional)...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search events..." value={daybookEventSearch} onValueChange={setDaybookEventSearch} data-testid="input-daybook-event-search" />
                    <CommandEmpty>No events found.</CommandEmpty>
                    <CommandGroup className="max-h-60 overflow-y-auto">
                      <CommandItem value="none" onSelect={() => { setDaybookEventId(''); setDaybookEventOpen(false); }}>
                        <Check className={`mr-2 h-4 w-4 ${!daybookEventId ? 'opacity-100' : 'opacity-0'}`} />
                        No event (general expense)
                      </CommandItem>
                      {events.map((event: any) => (
                        <CommandItem key={event.id} value={event.title} onSelect={() => { setDaybookEventId(event.id); setDaybookEventOpen(false); }} data-testid={`option-daybook-event-${event.id}`}>
                          <Check className={`mr-2 h-4 w-4 ${daybookEventId === event.id ? 'opacity-100' : 'opacity-0'}`} />
                          {event.title}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Expense Category</Label>
              <Select value={daybookCategory} onValueChange={setDaybookCategory}>
                <SelectTrigger data-testid="select-daybook-category">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="travel">Travel</SelectItem>
                  <SelectItem value="meals">Meals</SelectItem>
                  <SelectItem value="supplies">Office Supplies</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="transportation">Transportation</SelectItem>
                  <SelectItem value="accommodation">Accommodation</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bank Account (Optional)</Label>
              <Select value={daybookBankId} onValueChange={setDaybookBankId}>
                <SelectTrigger data-testid="select-daybook-bank">
                  <SelectValue placeholder="Select bank for payment..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Cash / No Bank</SelectItem>
                  {banks.map((bank: any) => (
                    <SelectItem key={bank.id} value={bank.id}>
                      {bank.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Bank balance will be deducted if selected</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDaybookDialogOpen(false)}>Cancel</Button>
            <Button
              className="bg-[#7C8B5D] hover:bg-[#6a7a4d]"
              onClick={confirmPushToDaybook}
              disabled={pushToDaybook.isPending}
              data-testid="button-confirm-push-daybook"
            >
              {pushToDaybook.isPending ? 'Pushing...' : 'Push to Daybook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditQuickEntryDialogOpen} onOpenChange={setIsEditQuickEntryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Quick Entry
            </DialogTitle>
            <DialogDescription>
              Update the quick entry details or reassign to a different employee
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reassign to Employee</Label>
              <Select 
                value={editQuickEntryForm.employeeId} 
                onValueChange={(value) => setEditQuickEntryForm({ ...editQuickEntryForm, employeeId: value })}
              >
                <SelectTrigger data-testid="select-edit-quick-entry-employee">
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Change which employee this entry belongs to</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Amount (₹)</Label>
                <Input
                  type="number"
                  value={editQuickEntryForm.amount}
                  onChange={(e) => setEditQuickEntryForm({ ...editQuickEntryForm, amount: e.target.value })}
                  placeholder="Enter amount"
                  data-testid="input-edit-quick-entry-amount"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select 
                  value={editQuickEntryForm.direction} 
                  onValueChange={(value: 'paid' | 'received') => setEditQuickEntryForm({ ...editQuickEntryForm, direction: value })}
                >
                  <SelectTrigger data-testid="select-edit-quick-entry-direction">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid (Expense)</SelectItem>
                    <SelectItem value="received">Received (Income)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Link to Event (Optional)</Label>
              <Popover open={editEventOpen} onOpenChange={setEditEventOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={editEventOpen}
                    className="w-full justify-between font-normal"
                    data-testid="combobox-edit-quick-entry-event"
                  >
                    {editQuickEntryForm.eventId
                      ? events.find((e: any) => e.id === editQuickEntryForm.eventId)?.clientName || 'Select event...'
                      : 'No event linked'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search events..." 
                      value={editEventSearch}
                      onValueChange={setEditEventSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No events found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="none"
                          onSelect={() => {
                            setEditQuickEntryForm({ ...editQuickEntryForm, eventId: '' });
                            setEditEventOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", !editQuickEntryForm.eventId ? "opacity-100" : "opacity-0")} />
                          No event linked
                        </CommandItem>
                        {events
                          .filter((event: any) => 
                            event.clientName?.toLowerCase().includes(editEventSearch.toLowerCase()) ||
                            event.venue?.toLowerCase().includes(editEventSearch.toLowerCase())
                          )
                          .slice(0, 50)
                          .map((event: any) => (
                            <CommandItem
                              key={event.id}
                              value={event.id}
                              onSelect={() => {
                                setEditQuickEntryForm({ ...editQuickEntryForm, eventId: event.id });
                                setEditEventOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", editQuickEntryForm.eventId === event.id ? "opacity-100" : "opacity-0")} />
                              {event.clientName} - {event.venue ? event.venue : 'No venue'}
                            </CommandItem>
                          ))
                        }
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">Link this entry to an event for better tracking</p>
            </div>
            <div className="space-y-2">
              <Label>Counterparty / Vendor</Label>
              <Input
                value={editQuickEntryForm.counterpartyName}
                onChange={(e) => setEditQuickEntryForm({ ...editQuickEntryForm, counterpartyName: e.target.value })}
                placeholder="Vendor or person name"
                data-testid="input-edit-quick-entry-counterparty"
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editQuickEntryForm.notes}
                onChange={(e) => setEditQuickEntryForm({ ...editQuickEntryForm, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={2}
                data-testid="textarea-edit-quick-entry-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditQuickEntryDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveQuickEntry} 
              disabled={updateQuickEntryMutation.isPending}
              data-testid="button-save-quick-entry"
            >
              {updateQuickEntryMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ConsolidatedReportSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [backfillResult, setBackfillResult] = useState<{
    results: Array<{ employee: any; credentials: { employeeId: string; email: string; temporaryPassword: string } }>;
  } | null>(null);
  const [showBackfillResults, setShowBackfillResults] = useState(false);

  const { data: consolidatedReport, isLoading: reportLoading, isError: reportError } = useQuery<ConsolidatedReport>({
    queryKey: ['/api/hr/consolidated-report'],
    queryFn: async () => {
      const res = await fetch('/api/hr/consolidated-report', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch consolidated report');
      return res.json();
    },
  });

  const { data: employeesWithoutUser = [] } = useQuery<Employee[]>({
    queryKey: ['/api/employees/without-user-account'],
    queryFn: async () => {
      const res = await fetch('/api/employees/without-user-account', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch employees');
      return res.json();
    },
  });

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/employees/backfill-user-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to create user accounts');
      return res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['/api/employees'] });
      queryClient.invalidateQueries({ queryKey: ['/api/employees/without-user-account'] });
      setBackfillResult(result);
      setShowBackfillResults(true);
      toast({
        title: "User Accounts Created",
        description: `Created ${result.created} portal accounts for employees.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create accounts",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-4">
      {/* Backfill Alert */}
      {employeesWithoutUser.length > 0 && (
        <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/30">
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="font-medium text-orange-800 dark:text-orange-200">
                    {employeesWithoutUser.length} employee{employeesWithoutUser.length !== 1 ? 's' : ''} without portal access
                  </p>
                  <p className="text-sm text-orange-600 dark:text-orange-400">
                    These employees cannot login to the Employee Portal
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => backfillMutation.mutate()}
                disabled={backfillMutation.isPending}
                data-testid="button-backfill-users"
              >
                {backfillMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4 mr-2" />
                    Create Portal Accounts
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Backfill Results Dialog */}
      <Dialog open={showBackfillResults} onOpenChange={setShowBackfillResults}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              Employee Portal Credentials Created
            </DialogTitle>
            <DialogDescription>
              Copy and share these credentials with employees. Passwords should be changed on first login.
            </DialogDescription>
          </DialogHeader>
          {backfillResult && (
            <div className="space-y-4">
              <div className="space-y-3">
                {backfillResult.results.map((result, index) => (
                  <div key={index} className="bg-muted/50 rounded-lg p-3 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{result.employee?.name}</span>
                      <Badge variant="outline">{result.credentials.employeeId}</Badge>
                    </div>
                    <div className="text-sm grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-muted-foreground">Email: </span>
                        <span className="font-mono">{result.credentials.email}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Password: </span>
                        <span className="font-mono text-primary">{result.credentials.temporaryPassword}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    const text = backfillResult.results.map(r => 
                      `${r.employee?.name}\nEmployee ID: ${r.credentials.employeeId}\nEmail: ${r.credentials.email}\nPassword: ${r.credentials.temporaryPassword}\n`
                    ).join('\n---\n\n');
                    navigator.clipboard.writeText(text);
                    toast({ title: "All credentials copied to clipboard" });
                  }}
                  data-testid="button-copy-all-credentials"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy All
                </Button>
                <Button className="flex-1" onClick={() => setShowBackfillResults(false)}>
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    <Card>
      <CardHeader className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileBarChart className="h-5 w-5" />
              Consolidated Employee Report
            </CardTitle>
            <CardDescription>
              FY {consolidatedReport?.fiscalYear || '-'} • All employee metrics in one view
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" data-testid="button-export-report">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-0">
        {reportLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : reportError ? (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            Failed to load report data. Please try refreshing the page.
          </div>
        ) : consolidatedReport ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Total Employees</div>
                  <div className="text-xl font-bold" data-testid="stat-total-employees">
                    {consolidatedReport.summary.totalEmployees}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Total Payroll</div>
                  <div className="text-xl font-bold text-green-600" data-testid="stat-total-payroll">
                    ₹{consolidatedReport.summary.totalPayroll.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Incentives</div>
                  <div className="text-xl font-bold text-blue-600" data-testid="stat-total-incentives">
                    ₹{consolidatedReport.summary.totalIncentives.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Loss of Pay</div>
                  <div className="text-xl font-bold text-red-600" data-testid="stat-total-lop">
                    ₹{consolidatedReport.summary.totalLossOfPay.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Advances</div>
                  <div className="text-xl font-bold text-orange-600" data-testid="stat-total-advances">
                    ₹{consolidatedReport.summary.totalAdvances.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-muted/50">
                <CardContent className="p-3">
                  <div className="text-xs text-muted-foreground">Expenses</div>
                  <div className="text-xl font-bold text-purple-600" data-testid="stat-total-expenses">
                    ₹{consolidatedReport.summary.totalExpenses.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="min-w-[140px]">Employee</TableHead>
                    <TableHead>Designation</TableHead>
                    <TableHead className="text-right">Salary</TableHead>
                    <TableHead className="text-center">Leaves Used</TableHead>
                    <TableHead className="text-center">LOP Days</TableHead>
                    <TableHead className="text-right">LOP Amount</TableHead>
                    <TableHead className="text-right">Incentives</TableHead>
                    <TableHead className="text-right">Advances</TableHead>
                    <TableHead className="text-right">Net Payroll</TableHead>
                    <TableHead>Contract Renewal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {consolidatedReport.employees.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                        No employee data available
                      </TableCell>
                    </TableRow>
                  ) : (
                    consolidatedReport.employees.map((data: ConsolidatedEmployeeData) => (
                      <TableRow key={data.employee.id} data-testid={`row-report-${data.employee.id}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{data.employee.name}</div>
                            <div className="text-xs text-muted-foreground">{data.employee.employeeId}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div>{data.employee.designation}</div>
                            <div className="text-xs text-muted-foreground">{data.employee.department || '-'}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ₹{Number(data.employee.salary).toLocaleString('en-IN')}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center">
                            <span className="font-medium">{data.leaveMetrics.leavesUsed}</span>
                            <span className="text-xs text-muted-foreground">of {data.leaveMetrics.totalLeaves}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {data.leaveMetrics.lossOfPayDays > 0 ? (
                            <Badge variant="destructive">{data.leaveMetrics.lossOfPayDays}</Badge>
                          ) : (
                            <span className="text-muted-foreground">0</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono text-red-600">
                          {data.financialMetrics.lossOfPayAmount > 0 
                            ? `₹${data.financialMetrics.lossOfPayAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-blue-600">
                          {data.financialMetrics.totalIncentives > 0 
                            ? `₹${data.financialMetrics.totalIncentives.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-orange-600">
                          {data.financialMetrics.approvedAdvances > 0 
                            ? `₹${data.financialMetrics.approvedAdvances.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-green-600">
                          ₹{data.financialMetrics.netPayroll.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </TableCell>
                        <TableCell>
                          {data.contractRenewalDate ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDate(data.contractRenewalDate)}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            No report data available
          </div>
        )}
      </CardContent>
    </Card>
    </div>
  );
}

interface LeaveRecord {
  id: string;
  employeeId: string;
  employeeName?: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  reason: string | null;
  status: string;
  createdAt: string;
  isManualEntry?: boolean;
}

function LeaveTrackerSection({ employees }: { employees: Employee[] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>(new Date().getFullYear().toString());
  const [employeeSearchOpen, setEmployeeSearchOpen] = useState(false);
  const [filterEmployeeSearchOpen, setFilterEmployeeSearchOpen] = useState(false);

  const { data: leaveRecords = [], isLoading } = useQuery<LeaveRecord[]>({
    queryKey: ['/api/leave-requests'],
    queryFn: async () => {
      const res = await fetch('/api/leave-requests');
      if (!res.ok) throw new Error('Failed to fetch leave records');
      return res.json();
    },
    refetchInterval: 30000,
  });

  const enrichedLeaves = useMemo(() => {
    return leaveRecords.map(leave => {
      const employee = employees.find(e => e.id === leave.employeeId);
      return {
        ...leave,
        employeeName: employee?.name || 'Unknown Employee',
      };
    });
  }, [leaveRecords, employees]);

  const filteredLeaves = useMemo(() => {
    return enrichedLeaves.filter(leave => {
      if (filterEmployee !== 'all' && leave.employeeId !== filterEmployee) return false;
      if (filterStatus !== 'all' && leave.status !== filterStatus) return false;
      if (filterYear !== 'all') {
        const leaveYear = new Date(leave.startDate).getFullYear().toString();
        if (leaveYear !== filterYear) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [enrichedLeaves, filterEmployee, filterStatus, filterYear]);

  const leaveStats = useMemo(() => {
    const yearLeaves = enrichedLeaves.filter(l => {
      if (filterYear === 'all') return true;
      return new Date(l.startDate).getFullYear().toString() === filterYear;
    });
    
    const approved = yearLeaves.filter(l => l.status === 'approved').length;
    const pending = yearLeaves.filter(l => l.status === 'pending').length;
    const rejected = yearLeaves.filter(l => l.status === 'rejected').length;
    
    return { total: yearLeaves.length, approved, pending, rejected };
  }, [enrichedLeaves, filterYear]);

  const years = useMemo(() => {
    const yearsSet = new Set<string>();
    enrichedLeaves.forEach(leave => {
      yearsSet.add(new Date(leave.startDate).getFullYear().toString());
    });
    return Array.from(yearsSet).sort((a, b) => parseInt(b) - parseInt(a));
  }, [enrichedLeaves]);

  const createLeaveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create leave record');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leave-requests'] });
      toast({ title: "Leave record added successfully" });
      setIsAddDialogOpen(false);
      setSelectedEmployeeId("");
    },
    onError: () => {
      toast({ title: "Failed to add leave record", variant: "destructive" });
    },
  });

  const deleteLeaveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/leave-requests/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete leave record');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leave-requests'] });
      toast({ title: "Leave record deleted" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/leave-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/leave-requests'] });
      toast({ title: "Status updated" });
    },
  });

  const handleAddLeave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    if (!selectedEmployeeId) {
      toast({ title: "Please select an employee", variant: "destructive" });
      return;
    }

    createLeaveMutation.mutate({
      employeeId: selectedEmployeeId,
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
      leaveType: formData.get('leaveType'),
      reason: formData.get('reason') || null,
      status: formData.get('status') || 'approved',
    });
  };

  const calculateDays = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId);
  const filterSelectedEmployee = employees.find(e => e.id === filterEmployee);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Leaves</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{leaveStats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-green-600">Approved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{leaveStats.approved}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-600">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">{leaveStats.pending}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">Rejected</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{leaveStats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Leave Tracker
              </CardTitle>
              <CardDescription>Monitor and manage employee leaves</CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-leave">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Leave Entry
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Leave Entry</DialogTitle>
                  <DialogDescription>Manually record an employee's leave</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleAddLeave} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Employee *</Label>
                    <Popover open={employeeSearchOpen} onOpenChange={setEmployeeSearchOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          aria-expanded={employeeSearchOpen}
                          className="w-full justify-between"
                          data-testid="select-leave-employee"
                        >
                          {selectedEmployee ? selectedEmployee.name : "Select employee..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search employee..." />
                          <CommandList>
                            <CommandEmpty>No employee found.</CommandEmpty>
                            <CommandGroup>
                              {employees.map((emp) => (
                                <CommandItem
                                  key={emp.id}
                                  value={emp.name}
                                  onSelect={() => {
                                    setSelectedEmployeeId(emp.id);
                                    setEmployeeSearchOpen(false);
                                  }}
                                >
                                  <Check className={cn("mr-2 h-4 w-4", selectedEmployeeId === emp.id ? "opacity-100" : "opacity-0")} />
                                  {emp.name}
                                  <span className="ml-2 text-xs text-muted-foreground">{emp.employeeId}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startDate">Start Date *</Label>
                      <Input type="date" id="startDate" name="startDate" required data-testid="input-leave-start" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="endDate">End Date *</Label>
                      <Input type="date" id="endDate" name="endDate" required data-testid="input-leave-end" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="leaveType">Leave Type</Label>
                      <Select name="leaveType" defaultValue="casual">
                        <SelectTrigger data-testid="select-leave-type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="casual">Casual Leave</SelectItem>
                          <SelectItem value="sick">Sick Leave</SelectItem>
                          <SelectItem value="earned">Earned Leave</SelectItem>
                          <SelectItem value="lop">Loss of Pay</SelectItem>
                          <SelectItem value="maternity">Maternity Leave</SelectItem>
                          <SelectItem value="paternity">Paternity Leave</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select name="status" defaultValue="approved">
                        <SelectTrigger data-testid="select-leave-status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason</Label>
                    <Textarea id="reason" name="reason" placeholder="Optional reason for leave" data-testid="input-leave-reason" />
                  </div>

                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={createLeaveMutation.isPending} data-testid="button-submit-leave">
                      {createLeaveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Add Leave
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Employee:</Label>
              <Popover open={filterEmployeeSearchOpen} onOpenChange={setFilterEmployeeSearchOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-[200px] justify-between" data-testid="filter-employee">
                    {filterEmployee === 'all' ? "All Employees" : filterSelectedEmployee?.name || "Select..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-0">
                  <Command>
                    <CommandInput placeholder="Search..." />
                    <CommandList>
                      <CommandEmpty>No employee found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem onSelect={() => { setFilterEmployee('all'); setFilterEmployeeSearchOpen(false); }}>
                          <Check className={cn("mr-2 h-4 w-4", filterEmployee === 'all' ? "opacity-100" : "opacity-0")} />
                          All Employees
                        </CommandItem>
                        {employees.map((emp) => (
                          <CommandItem
                            key={emp.id}
                            value={emp.name}
                            onSelect={() => { setFilterEmployee(emp.id); setFilterEmployeeSearchOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", filterEmployee === emp.id ? "opacity-100" : "opacity-0")} />
                            {emp.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Status:</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[130px]" data-testid="filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="text-sm whitespace-nowrap">Year:</Label>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[100px]" data-testid="filter-year">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  {years.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredLeaves.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No leave records found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeaves.map((leave) => (
                    <TableRow key={leave.id} data-testid={`row-leave-${leave.id}`}>
                      <TableCell className="font-medium">{leave.employeeName}</TableCell>
                      <TableCell className="capitalize">{leave.leaveType?.replace('_', ' ') || 'Casual'}</TableCell>
                      <TableCell>{format(parseISO(leave.startDate), 'dd MMM yyyy')}</TableCell>
                      <TableCell>{format(parseISO(leave.endDate), 'dd MMM yyyy')}</TableCell>
                      <TableCell className="text-center font-medium">{calculateDays(leave.startDate, leave.endDate)}</TableCell>
                      <TableCell className="max-w-[150px] truncate">{leave.reason || '-'}</TableCell>
                      <TableCell>
                        <Select
                          value={leave.status}
                          onValueChange={(status) => updateStatusMutation.mutate({ id: leave.id, status })}
                        >
                          <SelectTrigger className="w-[100px] h-7">
                            <Badge
                              variant={leave.status === 'approved' ? 'default' : leave.status === 'pending' ? 'secondary' : 'destructive'}
                              className="text-xs"
                            >
                              {leave.status}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="approved">Approved</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="rejected">Rejected</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => deleteLeaveMutation.mutate(leave.id)}
                          data-testid={`button-delete-leave-${leave.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

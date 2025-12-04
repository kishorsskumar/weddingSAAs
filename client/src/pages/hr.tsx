import { useState } from "react";
import type { Employee } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus, Phone, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function HR() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ['/api/employees'],
    queryFn: async () => {
      const res = await fetch('/api/employees');
      if (!res.ok) throw new Error('Failed to fetch employees');
      return res.json();
    },
  });

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

  const AddEmployeeForm = () => {
    const { register, handleSubmit } = useForm<Partial<Employee>>();
    const onSubmit = (data: any) => {
      createMutation.mutate(data);
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input {...register("name")} required />
          </div>
          <div className="space-y-2">
            <Label>Employee ID</Label>
            <Input {...register("employeeId")} required />
          </div>
          <div className="space-y-2">
            <Label>Designation</Label>
            <Input {...register("designation")} required />
          </div>
          <div className="space-y-2">
            <Label>Salary</Label>
            <Input type="number" {...register("salary")} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Address</Label>
          <Input {...register("address")} required />
        </div>
        <div className="space-y-2">
          <Label>Emergency Contact</Label>
          <Input {...register("emergencyContact")} required />
        </div>
        <div className="space-y-2">
          <Label>Joining Date</Label>
          <Input type="date" {...register("joinDate")} required />
        </div>
        <Button type="submit" className="w-full" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Adding...' : 'Add Employee'}
        </Button>
      </form>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold font-serif text-primary">Human Resources</h1>
          <p className="text-sm text-muted-foreground">Employee Management & Payroll</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 w-full sm:w-auto" data-testid="button-add-employee"><Plus className="h-4 w-4" /> New Employee</Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <AddEmployeeForm />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList className="w-full sm:w-auto flex">
          <TabsTrigger value="employees" className="flex-1 sm:flex-none text-xs sm:text-sm">Employees</TabsTrigger>
          <TabsTrigger value="leaves" className="flex-1 sm:flex-none text-xs sm:text-sm">Leaves</TabsTrigger>
          <TabsTrigger value="payroll" className="flex-1 sm:flex-none text-xs sm:text-sm">Payroll</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4">
          <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {employees.map((emp) => (
              <Card key={emp.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center gap-3 sm:gap-4 pb-2 p-4 sm:p-6 sm:pb-2">
                  <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {emp.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-sm sm:text-base truncate">{emp.name}</CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{emp.designation}</p>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                  <div className="grid gap-2 text-xs sm:text-sm mt-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Badge variant="outline" className="font-mono text-[10px] sm:text-xs">{emp.employeeId}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                       <Phone className="h-3 w-3 flex-shrink-0" /> <span className="truncate">{emp.emergencyContact}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                       <MapPin className="h-3 w-3 flex-shrink-0" /> <span className="truncate">{emp.address}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {employees.length === 0 && (
              <div className="col-span-full text-center py-8 text-muted-foreground text-sm">
                No employees found. Add your first employee to get started.
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="leaves">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg">Pending Leave Requests</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="text-center py-6 sm:py-8 text-muted-foreground text-sm">
                No pending leave requests.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
           <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg">Payroll Estimate</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="min-w-[400px] px-4 sm:px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs sm:text-sm">Employee</TableHead>
                        <TableHead className="text-xs sm:text-sm">Base Salary</TableHead>
                        <TableHead className="text-xs sm:text-sm">Deductions</TableHead>
                        <TableHead className="text-right text-xs sm:text-sm">Net Payable</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employees.map(emp => (
                        <TableRow key={emp.id}>
                          <TableCell className="text-xs sm:text-sm">{emp.name}</TableCell>
                          <TableCell className="text-xs sm:text-sm">₹{Number(emp.salary).toLocaleString()}</TableCell>
                          <TableCell className="text-xs sm:text-sm">₹0</TableCell>
                          <TableCell className="text-right font-bold text-xs sm:text-sm">₹{Number(emp.salary).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                      {employees.length > 0 && (
                        <TableRow className="bg-muted/50 font-bold">
                          <TableCell colSpan={3} className="text-xs sm:text-sm">Total Payroll</TableCell>
                          <TableCell className="text-right text-primary text-xs sm:text-sm">
                            ₹{employees.reduce((acc, curr) => acc + Number(curr.salary), 0).toLocaleString()}
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

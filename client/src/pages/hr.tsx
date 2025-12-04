import { useState } from "react";
import { MOCK_EMPLOYEES, Employee } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, Phone, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";

export default function HR() {
  const [employees, setEmployees] = useState<Employee[]>(MOCK_EMPLOYEES);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const AddEmployeeForm = () => {
    const { register, handleSubmit } = useForm<Partial<Employee>>();
    const onSubmit = (data: any) => {
      const newEmp: Employee = {
        id: Math.random().toString(36).substr(2, 9),
        ...data,
        salary: Number(data.salary)
      };
      setEmployees([...employees, newEmp]);
      setIsDialogOpen(false);
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
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
            <Label>Salary (₹)</Label>
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
        <Button type="submit" className="w-full">Add Employee</Button>
      </form>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif text-primary">Human Resources</h1>
          <p className="text-muted-foreground">Employee Management & Payroll</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Employee</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <AddEmployeeForm />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">All Employees</TabsTrigger>
          <TabsTrigger value="leaves">Leave Requests</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {employees.map((emp) => (
              <Card key={emp.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center gap-4 pb-2">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {emp.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base">{emp.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{emp.designation}</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 text-sm mt-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Badge variant="outline" className="font-mono text-xs">{emp.employeeId}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                       <Phone className="h-3 w-3" /> {emp.emergencyContact}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground truncate">
                       <MapPin className="h-3 w-3" /> {emp.address}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="leaves">
          <Card>
            <CardHeader>
              <CardTitle>Pending Leave Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                No pending leave requests.
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payroll">
           <Card>
            <CardHeader>
              <CardTitle>Payroll Estimate</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Base Salary</TableHead>
                    <TableHead>Deductions</TableHead>
                    <TableHead className="text-right">Net Payable</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map(emp => (
                    <TableRow key={emp.id}>
                      <TableCell>{emp.name}</TableCell>
                      <TableCell>₹{emp.salary.toLocaleString()}</TableCell>
                      <TableCell>₹0</TableCell>
                      <TableCell className="text-right font-bold">₹{emp.salary.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={3}>Total Payroll (Due 5th)</TableCell>
                    <TableCell className="text-right text-primary">
                      ₹{employees.reduce((acc, curr) => acc + curr.salary, 0).toLocaleString()}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

import { useState } from "react";
import type { DaybookEntry, Bank } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarIcon, TrendingUp, TrendingDown, Wallet, Plus, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";

export default function Daybook() {
  const [filterType, setFilterType] = useState<"daily" | "weekly" | "monthly">("daily");
  const [currentDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';

  const { data: entries = [] } = useQuery<DaybookEntry[]>({
    queryKey: ['/api/daybook'],
    queryFn: async () => {
      const res = await fetch('/api/daybook');
      if (!res.ok) throw new Error('Failed to fetch daybook entries');
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

  const createMutation = useMutation({
    mutationFn: async (data: Partial<DaybookEntry>) => {
      const res = await fetch('/api/daybook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create entry');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/daybook'] });
      setIsDialogOpen(false);
    },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/daybook/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete entry');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/daybook'] });
    },
  });

  const createBankMutation = useMutation({
    mutationFn: async (data: { name: string; balance: string }) => {
      const res = await fetch('/api/banks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create bank');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
      setIsBankDialogOpen(false);
    },
  });

  const updateBankMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Bank> }) => {
      const res = await fetch(`/api/banks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update bank');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
      setEditingBank(null);
    },
  });

  const deleteBankMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/banks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete bank');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
    },
  });

  const AddEntryForm = () => {
    const { register, handleSubmit, setValue } = useForm<Partial<DaybookEntry>>();
    
    const onSubmit = (data: any) => {
      createMutation.mutate({
        ...data,
        date: format(new Date(), "yyyy-MM-dd"),
      });
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label>Description</Label>
          <Input {...register("description")} required />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select onValueChange={(v) => setValue("type", v as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="income">Income</SelectItem>
                <SelectItem value="expense">Expense</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount (₹)</Label>
            <Input type="number" {...register("amount")} required />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Category</Label>
          <Input {...register("category")} placeholder="e.g. Rent, Sales, Food" />
        </div>
        <Button type="submit" className="w-full" disabled={createMutation.isPending}>
          {createMutation.isPending ? 'Adding...' : 'Add Entry'}
        </Button>
      </form>
    );
  };

  const AddBankForm = () => {
    const { register, handleSubmit } = useForm<{ name: string; balance: string }>();
    
    const onSubmit = (data: any) => {
      createBankMutation.mutate(data);
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label>Bank Name</Label>
          <Input {...register("name")} required placeholder="e.g. HDFC Bank" />
        </div>
        <div className="space-y-2">
          <Label>Opening Balance (₹)</Label>
          <Input type="number" {...register("balance")} required placeholder="0" />
        </div>
        <Button type="submit" className="w-full" disabled={createBankMutation.isPending}>
          {createBankMutation.isPending ? 'Adding...' : 'Add Bank'}
        </Button>
      </form>
    );
  };

  const EditBankForm = ({ bank, onClose }: { bank: Bank; onClose: () => void }) => {
    const { register, handleSubmit } = useForm<{ name: string; balance: string }>({
      defaultValues: { name: bank.name, balance: bank.balance }
    });
    
    const onSubmit = (data: any) => {
      updateBankMutation.mutate({ id: bank.id, data });
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label>Bank Name</Label>
          <Input {...register("name")} required />
        </div>
        <div className="space-y-2">
          <Label>Balance (₹)</Label>
          <Input type="number" {...register("balance")} required />
        </div>
        <Button type="submit" className="w-full" disabled={updateBankMutation.isPending}>
          {updateBankMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    );
  };

  const totalIncome = entries.filter(e => e.type === "income").reduce((acc, curr) => acc + Number(curr.amount), 0);
  const totalExpense = entries.filter(e => e.type === "expense").reduce((acc, curr) => acc + Number(curr.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif text-primary">Daybook</h1>
          <p className="text-muted-foreground">Financial Overview & Cash Flow</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-card">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{format(currentDate, "dd MMM yyyy")}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span className="text-2xl font-bold text-green-700">₹{totalIncome.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-600">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              <span className="text-2xl font-bold text-red-700">₹{totalExpense.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Net Cash Flow</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              <span className="text-2xl font-bold">₹{(totalIncome - totalExpense).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-lg">Bank Balances</CardTitle>
            {isAdmin && (
              <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1" data-testid="button-add-bank">
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Bank Account</DialogTitle>
                  </DialogHeader>
                  <AddBankForm />
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {banks.map((bank) => (
              <div key={bank.id} className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border group">
                <div>
                  <span className="font-medium">{bank.name}</span>
                  <div className="font-bold font-mono text-lg">₹{Number(bank.balance).toLocaleString()}</div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Dialog open={editingBank?.id === bank.id} onOpenChange={(open) => !open && setEditingBank(null)}>
                      <DialogTrigger asChild>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8"
                          onClick={() => setEditingBank(bank)}
                          data-testid={`button-edit-bank-${bank.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Bank Balance</DialogTitle>
                        </DialogHeader>
                        <EditBankForm bank={bank} onClose={() => setEditingBank(null)} />
                      </DialogContent>
                    </Dialog>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Delete ${bank.name}?`)) deleteBankMutation.mutate(bank.id);
                      }}
                      data-testid={`button-delete-bank-${bank.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
            {banks.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No banks added yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-lg">Transactions</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2" data-testid="button-add-entry"><Plus className="h-4 w-4"/> Add Entry</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Daybook Entry</DialogTitle>
                </DialogHeader>
                <AddEntryForm />
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  {isAdmin && <TableHead className="w-10"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 4 : 3} className="text-center py-8 text-muted-foreground">No transactions found.</TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.description}</TableCell>
                      <TableCell>
                        <span className="px-2 py-1 rounded bg-muted text-xs text-muted-foreground">
                          {entry.category}
                        </span>
                      </TableCell>
                      <TableCell className={cn("text-right font-mono font-medium", 
                        entry.type === "income" ? "text-green-600" : "text-red-600"
                      )}>
                        {entry.type === "income" ? "+" : "-"}₹{Number(entry.amount).toLocaleString()}
                      </TableCell>
                      {isAdmin && (
                        <TableCell>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Delete this entry?`)) deleteEntryMutation.mutate(entry.id);
                            }}
                            data-testid={`button-delete-entry-${entry.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

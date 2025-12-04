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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <Label>Amount</Label>
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
          <Label>Opening Balance</Label>
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
          <Label>Balance</Label>
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
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold font-serif text-primary">Daybook</h1>
          <p className="text-sm text-muted-foreground">Financial Overview & Cash Flow</p>
        </div>
        <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-card w-fit">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs sm:text-sm font-medium">{format(currentDate, "dd MMM yyyy")}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Card className="border-l-4 border-l-green-600">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Income</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-green-600" />
              <span className="text-lg sm:text-2xl font-bold text-green-700">₹{totalIncome.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-600">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 sm:h-5 sm:w-5 text-red-600" />
              <span className="text-lg sm:text-2xl font-bold text-red-700">₹{totalExpense.toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardHeader className="pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">Net Cash Flow</CardTitle>
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <span className="text-lg sm:text-2xl font-bold">₹{(totalIncome - totalExpense).toLocaleString()}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <Card className="lg:col-span-1 h-fit order-1">
          <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
            <CardTitle className="font-serif text-lg">Bank Balances</CardTitle>
            {isAdmin && (
              <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-1 h-8 text-xs" data-testid="button-add-bank">
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Bank Account</DialogTitle>
                  </DialogHeader>
                  <AddBankForm />
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3 p-4 pt-0 sm:p-6 sm:pt-0">
            {banks.map((bank) => (
              <div key={bank.id} className="flex justify-between items-center p-2 sm:p-3 rounded-lg bg-muted/30 border group">
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-sm truncate block">{bank.name}</span>
                  <div className="font-bold font-mono text-base sm:text-lg">₹{Number(bank.balance).toLocaleString()}</div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1 flex-shrink-0">
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
                      <DialogContent className="max-w-[95vw] sm:max-w-md">
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
              <p className="text-center text-muted-foreground py-4 text-sm">No banks added yet</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 order-2">
          <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
            <CardTitle className="font-serif text-lg">Transactions</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1 h-8 text-xs sm:text-sm" data-testid="button-add-entry"><Plus className="h-3 w-3 sm:h-4 sm:w-4"/> Add</Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Daybook Entry</DialogTitle>
                </DialogHeader>
                <AddEntryForm />
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="min-w-[350px] px-4 sm:px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-xs sm:text-sm">Description</TableHead>
                      <TableHead className="text-xs sm:text-sm">Category</TableHead>
                      <TableHead className="text-right text-xs sm:text-sm">Amount</TableHead>
                      {isAdmin && <TableHead className="w-10"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={isAdmin ? 4 : 3} className="text-center py-8 text-muted-foreground text-sm">No transactions found.</TableCell>
                      </TableRow>
                    ) : (
                      entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell className="font-medium text-xs sm:text-sm">{entry.description}</TableCell>
                          <TableCell>
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 rounded bg-muted text-[10px] sm:text-xs text-muted-foreground">
                              {entry.category}
                            </span>
                          </TableCell>
                          <TableCell className={cn("text-right font-mono font-medium text-xs sm:text-sm", 
                            entry.type === "income" ? "text-green-600" : "text-red-600"
                          )}>
                            {entry.type === "income" ? "+" : "-"}₹{Number(entry.amount).toLocaleString()}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-7 w-7 sm:h-8 sm:w-8 text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm(`Delete this entry?`)) deleteEntryMutation.mutate(entry.id);
                                }}
                                data-testid={`button-delete-entry-${entry.id}`}
                              >
                                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

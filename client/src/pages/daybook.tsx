import { useState, useMemo } from "react";
import type { DaybookEntry, Bank, BankTransfer } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon, TrendingUp, TrendingDown, Wallet, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, ArrowRightLeft, Building2, CalendarDays } from "lucide-react";
import { format, addDays, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isWithinInterval } from "date-fns";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";

export default function Daybook() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isTransactionDialogOpen, setIsTransactionDialogOpen] = useState(false);
  const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [periodType, setPeriodType] = useState<"day" | "month" | "year" | "custom">("month");
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
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

  const { data: transfers = [] } = useQuery<BankTransfer[]>({
    queryKey: ['/api/bank-transfers'],
    queryFn: async () => {
      const res = await fetch('/api/bank-transfers');
      if (!res.ok) throw new Error('Failed to fetch bank transfers');
      return res.json();
    },
  });

  const formattedDate = format(currentDate, "yyyy-MM-dd");

  const todayEntries = useMemo(() => {
    return entries.filter(e => e.date === formattedDate);
  }, [entries, formattedDate]);

  const todayTransfers = useMemo(() => {
    return transfers.filter(t => t.date === formattedDate);
  }, [transfers, formattedDate]);

  const incomeEntries = todayEntries.filter(e => e.type === "income");
  const expenseEntries = todayEntries.filter(e => e.type === "expense");

  const periodDateRange = useMemo(() => {
    switch (periodType) {
      case "day":
        return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
      case "month":
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
      case "year":
        return { start: startOfYear(currentDate), end: endOfYear(currentDate) };
      case "custom":
        return { start: parseISO(customStartDate), end: parseISO(customEndDate) };
      default:
        return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
    }
  }, [periodType, currentDate, customStartDate, customEndDate]);

  const periodEntries = useMemo(() => {
    return entries.filter(e => {
      const entryDate = parseISO(e.date);
      return isWithinInterval(entryDate, { start: periodDateRange.start, end: periodDateRange.end });
    });
  }, [entries, periodDateRange]);

  const periodIncome = periodEntries.filter(e => e.type === "income").reduce((acc, curr) => acc + Number(curr.amount), 0);
  const periodExpense = periodEntries.filter(e => e.type === "expense").reduce((acc, curr) => acc + Number(curr.amount), 0);
  const periodNetFlow = periodIncome - periodExpense;

  const totalBankBalance = banks.reduce((acc, bank) => acc + Number(bank.balance), 0);

  const getBankName = (id: string) => banks.find(b => b.id === id)?.name || "Unknown";

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
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
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

  const createTransferMutation = useMutation({
    mutationFn: async (data: { fromBankId: string; toBankId: string; amount: string; description?: string }) => {
      const res = await fetch('/api/bank-transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, date: formattedDate }),
      });
      if (!res.ok) throw new Error('Failed to create transfer');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bank-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
      setIsTransferDialogOpen(false);
    },
  });

  const deleteTransferMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/bank-transfers/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete transfer');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/bank-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
    },
  });

  const incomeCategories = ['Sales', 'Payment Received', 'Advance', 'Refund', 'Interest', 'Commission', 'Other Income'];
  const expenseCategories = ['Rent', 'Utilities', 'Salary', 'Office Supplies', 'Travel', 'Food', 'Marketing', 'Maintenance', 'Vendor Payment', 'Tax', 'Other Expense'];

  const AddTransactionForm = ({ onClose }: { onClose: () => void }) => {
    const { register, handleSubmit, setValue, watch, reset } = useForm<any>({
      defaultValues: {
        type: 'expense',
        date: formattedDate,
      }
    });
    const selectedType = watch("type") || 'expense';
    const selectedDate = watch("date") || formattedDate;
    
    const onSubmit = (data: any) => {
      createMutation.mutate({
        ...data,
        date: data.date || formattedDate,
      }, {
        onSuccess: () => {
          reset({
            type: selectedType,
            date: selectedDate,
            amount: '',
            bankId: undefined,
            category: '',
            eventName: '',
            vendorName: '',
            description: '',
          });
        }
      });
    };

    const categories = selectedType === 'income' ? incomeCategories : expenseCategories;

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select defaultValue="expense" onValueChange={(v) => setValue("type", v)}>
              <SelectTrigger data-testid="select-transaction-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input 
              type="number" 
              step="0.01" 
              {...register("amount")} 
              required 
              placeholder="0.00" 
              data-testid="input-amount"
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label>Date *</Label>
          <Input 
            type="date" 
            {...register("date")} 
            defaultValue={formattedDate}
            required 
            data-testid="input-date"
          />
        </div>

        <div className="space-y-2">
          <Label>Bank *</Label>
          <Select onValueChange={(v) => setValue("bankId", v)} required>
            <SelectTrigger data-testid="select-bank">
              <SelectValue placeholder="Select a bank..." />
            </SelectTrigger>
            <SelectContent>
              {banks.map((bank) => (
                <SelectItem key={bank.id} value={bank.id}>{bank.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Category *</Label>
          <Select onValueChange={(v) => setValue("category", v)} required>
            <SelectTrigger data-testid="select-category">
              <SelectValue placeholder="Select a category..." />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Event Name (Optional)</Label>
            <Input 
              {...register("eventName")} 
              placeholder="e.g., Smith Wedding" 
              data-testid="input-event-name"
            />
          </div>
          <div className="space-y-2">
            <Label>Vendor Name (Optional)</Label>
            <Input 
              {...register("vendorName")} 
              placeholder="e.g., ABC Catering" 
              data-testid="input-vendor-name"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <textarea 
            {...register("description")} 
            className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-y"
            placeholder="Add notes or details..."
            data-testid="input-description"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700" disabled={createMutation.isPending}>
            <Plus className="h-4 w-4 mr-1" />
            {createMutation.isPending ? 'Adding...' : 'Add Transaction'}
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground text-center">
          The window will stay open for multiple entries.
        </p>
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
          <Input type="number" step="0.01" {...register("balance")} required placeholder="0" />
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
          <Input type="number" step="0.01" {...register("balance")} required />
        </div>
        <Button type="submit" className="w-full" disabled={updateBankMutation.isPending}>
          {updateBankMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    );
  };

  const TransferForm = () => {
    const { register, handleSubmit, setValue, watch } = useForm<{ fromBankId: string; toBankId: string; amount: string; description: string }>();
    const fromBank = watch("fromBankId");
    const toBank = watch("toBankId");
    
    const onSubmit = (data: any) => {
      if (data.fromBankId === data.toBankId) {
        alert("Source and destination bank cannot be the same");
        return;
      }
      createTransferMutation.mutate(data);
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label>From Bank</Label>
          <Select onValueChange={(v) => setValue("fromBankId", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select Source Bank" />
            </SelectTrigger>
            <SelectContent>
              {banks.map((bank) => (
                <SelectItem key={bank.id} value={bank.id}>{bank.name} (₹{Number(bank.balance).toLocaleString()})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>To Bank</Label>
          <Select onValueChange={(v) => setValue("toBankId", v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select Destination Bank" />
            </SelectTrigger>
            <SelectContent>
              {banks.map((bank) => (
                <SelectItem key={bank.id} value={bank.id}>{bank.name} (₹{Number(bank.balance).toLocaleString()})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Amount</Label>
          <Input type="number" step="0.01" {...register("amount")} required placeholder="0.00" />
        </div>
        <div className="space-y-2">
          <Label>Description (Optional)</Label>
          <Input {...register("description")} placeholder="e.g. Transfer for operations" />
        </div>
        <Button type="submit" className="w-full" disabled={createTransferMutation.isPending}>
          {createTransferMutation.isPending ? 'Transferring...' : 'Transfer Funds'}
        </Button>
      </form>
    );
  };

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-3xl font-bold font-serif text-primary">Daybook</h1>
          <p className="text-sm text-muted-foreground">Daily Financial Tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setCurrentDate(subDays(currentDate, 1))}
            data-testid="button-prev-day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-card min-w-[140px] justify-center">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs sm:text-sm font-medium">{format(currentDate, "dd MMM yyyy")}</span>
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => setCurrentDate(addDays(currentDate, 1))}
            data-testid="button-next-day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentDate(new Date())}
            className="hidden sm:flex"
            data-testid="button-today"
          >
            Today
          </Button>
        </div>
      </div>

      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="daily" className="text-xs sm:text-sm">Daily View</TabsTrigger>
          <TabsTrigger value="summary" className="text-xs sm:text-sm">Period Summary</TabsTrigger>
          <TabsTrigger value="banks" className="text-xs sm:text-sm">Banks</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-l-4 border-l-green-600">
              <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <CardTitle className="font-serif text-lg text-green-700">Income</CardTitle>
                </div>
                <Button 
                  size="sm" 
                  className="gap-1 h-8 bg-green-600 hover:bg-green-700" 
                  data-testid="button-add-income"
                  onClick={() => setIsTransactionDialogOpen(true)}
                >
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="min-w-[300px] px-4 sm:px-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs">Bank</TableHead>
                          <TableHead className="text-right text-xs">Amount</TableHead>
                          {isAdmin && <TableHead className="w-8"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incomeEntries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isAdmin ? 4 : 3} className="text-center py-6 text-muted-foreground text-sm">No income entries for this day</TableCell>
                          </TableRow>
                        ) : (
                          incomeEntries.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="text-xs sm:text-sm">
                                <div className="font-medium">{entry.description}</div>
                                <div className="text-muted-foreground text-[10px]">{entry.category}</div>
                              </TableCell>
                              <TableCell className="text-xs">{entry.bankId ? getBankName(entry.bankId) : "-"}</TableCell>
                              <TableCell className="text-right font-mono font-medium text-xs sm:text-sm text-green-600">
                                +₹{Number(entry.amount).toLocaleString()}
                              </TableCell>
                              {isAdmin && (
                                <TableCell>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => {
                                      if (confirm(`Delete this entry?`)) deleteEntryMutation.mutate(entry.id);
                                    }}
                                    data-testid={`button-delete-income-${entry.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    <div className="mt-3 pt-3 border-t flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Total Income</span>
                      <span className="text-lg font-bold text-green-600">
                        ₹{incomeEntries.reduce((acc, e) => acc + Number(e.amount), 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-red-600">
              <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-red-600" />
                  <CardTitle className="font-serif text-lg text-red-700">Expenses</CardTitle>
                </div>
                <Button 
                  size="sm" 
                  className="gap-1 h-8 bg-red-600 hover:bg-red-700" 
                  data-testid="button-add-expense"
                  onClick={() => setIsTransactionDialogOpen(true)}
                >
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </CardHeader>
              <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="min-w-[300px] px-4 sm:px-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-xs">Bank</TableHead>
                          <TableHead className="text-right text-xs">Amount</TableHead>
                          {isAdmin && <TableHead className="w-8"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenseEntries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={isAdmin ? 4 : 3} className="text-center py-6 text-muted-foreground text-sm">No expense entries for this day</TableCell>
                          </TableRow>
                        ) : (
                          expenseEntries.map((entry) => (
                            <TableRow key={entry.id}>
                              <TableCell className="text-xs sm:text-sm">
                                <div className="font-medium">{entry.description}</div>
                                <div className="text-muted-foreground text-[10px]">{entry.category}</div>
                              </TableCell>
                              <TableCell className="text-xs">{entry.bankId ? getBankName(entry.bankId) : "-"}</TableCell>
                              <TableCell className="text-right font-mono font-medium text-xs sm:text-sm text-red-600">
                                -₹{Number(entry.amount).toLocaleString()}
                              </TableCell>
                              {isAdmin && (
                                <TableCell>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    onClick={() => {
                                      if (confirm(`Delete this entry?`)) deleteEntryMutation.mutate(entry.id);
                                    }}
                                    data-testid={`button-delete-expense-${entry.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                    <div className="mt-3 pt-3 border-t flex justify-between items-center">
                      <span className="text-sm font-medium text-muted-foreground">Total Expenses</span>
                      <span className="text-lg font-bold text-red-600">
                        ₹{expenseEntries.reduce((acc, e) => acc + Number(e.amount), 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-primary" />
                <CardTitle className="font-serif text-lg">Bank Transfers</CardTitle>
              </div>
              {isAdmin && banks.length >= 2 && (
                <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1 h-8" data-testid="button-add-transfer">
                      <Plus className="h-3 w-3" /> Transfer
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Transfer Between Banks</DialogTitle>
                    </DialogHeader>
                    <TransferForm />
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              {banks.length < 2 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">Add at least 2 banks to enable transfers</p>
              ) : todayTransfers.length === 0 ? (
                <p className="text-center text-muted-foreground py-4 text-sm">No transfers for this day</p>
              ) : (
                <div className="space-y-2">
                  {todayTransfers.map((transfer) => (
                    <div key={transfer.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium">{getBankName(transfer.fromBankId)}</span>
                          <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{getBankName(transfer.toBankId)}</span>
                        </div>
                        {transfer.description && (
                          <span className="text-xs text-muted-foreground">({transfer.description})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold">₹{Number(transfer.amount).toLocaleString()}</span>
                        {isAdmin && (
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm(`Delete this transfer?`)) deleteTransferMutation.mutate(transfer.id);
                            }}
                            data-testid={`button-delete-transfer-${transfer.id}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-primary">
            <CardContent className="p-4 sm:p-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" />
                  <span className="font-medium">Day's Net Cash Flow</span>
                </div>
                <span className={cn(
                  "text-xl font-bold font-mono",
                  (incomeEntries.reduce((acc, e) => acc + Number(e.amount), 0) - expenseEntries.reduce((acc, e) => acc + Number(e.amount), 0)) >= 0 
                    ? "text-green-600" 
                    : "text-red-600"
                )}>
                  ₹{(incomeEntries.reduce((acc, e) => acc + Number(e.amount), 0) - expenseEntries.reduce((acc, e) => acc + Number(e.amount), 0)).toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-5 w-5 text-primary" />
                  <CardTitle className="font-serif text-lg">Period Summary</CardTitle>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={periodType} onValueChange={(v) => setPeriodType(v as any)}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="year">Year</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  {periodType === "custom" && (
                    <div className="flex items-center gap-2">
                      <Input 
                        type="date" 
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-auto"
                      />
                      <span className="text-muted-foreground">to</span>
                      <Input 
                        type="date" 
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-auto"
                      />
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="text-sm text-muted-foreground mb-4">
                {format(periodDateRange.start, "dd MMM yyyy")} - {format(periodDateRange.end, "dd MMM yyyy")}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-700 dark:text-green-400">Total Income</span>
                  </div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">₹{periodIncome.toLocaleString()}</p>
                </div>
                <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-700 dark:text-red-400">Total Expenses</span>
                  </div>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">₹{periodExpense.toLocaleString()}</p>
                </div>
                <div className={cn(
                  "p-4 rounded-lg border",
                  periodNetFlow >= 0 
                    ? "bg-primary/5 border-primary/20" 
                    : "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900"
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Net Cash Flow</span>
                  </div>
                  <p className={cn(
                    "text-2xl font-bold",
                    periodNetFlow >= 0 ? "text-primary" : "text-orange-600 dark:text-orange-400"
                  )}>₹{periodNetFlow.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="banks" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <CardTitle className="font-serif text-lg">Bank Accounts</CardTitle>
              </div>
              {isAdmin && (
                <Dialog open={isBankDialogOpen} onOpenChange={setIsBankDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1 h-8" data-testid="button-add-bank">
                      <Plus className="h-3 w-3" /> Add Bank
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
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="grid gap-3">
                {banks.map((bank) => (
                  <div key={bank.id} className="flex justify-between items-center p-4 rounded-lg bg-muted/30 border group">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-base">{bank.name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="font-bold font-mono text-xl">₹{Number(bank.balance).toLocaleString()}</div>
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
                            <DialogContent className="max-w-[95vw] sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle>Edit Bank Account</DialogTitle>
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
                  </div>
                ))}
                {banks.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">No banks added yet</p>
                )}
              </div>
              {banks.length > 0 && (
                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                  <span className="font-medium text-muted-foreground">Total Bank Balance</span>
                  <span className="text-2xl font-bold font-mono text-primary">₹{totalBankBalance.toLocaleString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isTransactionDialogOpen} onOpenChange={setIsTransactionDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-serif">Add New Transaction</DialogTitle>
          </DialogHeader>
          <AddTransactionForm onClose={() => setIsTransactionDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

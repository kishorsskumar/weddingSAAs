import { useState } from "react";
import { MOCK_DAYBOOK, DaybookEntry } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar as CalendarIcon, TrendingUp, TrendingDown, Wallet, Plus } from "lucide-react";
import { format, isSameDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";

export default function Daybook() {
  const [entries, setEntries] = useState<DaybookEntry[]>(MOCK_DAYBOOK);
  const [filterType, setFilterType] = useState<"daily" | "weekly" | "monthly">("daily");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Bank Balances (Mock State)
  const [banks, setBanks] = useState([
    { id: 1, name: "HDFC Bank", balance: 1500000 },
    { id: 2, name: "SBI", balance: 450000 },
    { id: 3, name: "Cash in Hand", balance: 25000 },
  ]);

  const AddEntryForm = () => {
    const { register, handleSubmit } = useForm<Partial<DaybookEntry>>();
    const onSubmit = (data: any) => {
      const newEntry: DaybookEntry = {
        id: Math.random().toString(36).substr(2, 9),
        date: format(new Date(), "yyyy-MM-dd"),
        ...data,
        amount: Number(data.amount)
      };
      setEntries([...entries, newEntry]);
      
      // Update bank balance mock logic
      if (data.type === "income") {
        setBanks(banks.map(b => b.name === "Cash in Hand" ? { ...b, balance: b.balance + Number(data.amount) } : b));
      } else {
        setBanks(banks.map(b => b.name === "Cash in Hand" ? { ...b, balance: b.balance - Number(data.amount) } : b));
      }
      
      setIsDialogOpen(false);
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
            <Select onValueChange={(v) => register("type").onChange({ target: { value: v, name: "type" } })}>
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
        <Button type="submit" className="w-full">Add Entry</Button>
      </form>
    );
  };

  const filteredEntries = entries.filter(entry => {
    const entryDate = new Date(entry.date);
    if (filterType === "daily") return isSameDay(entryDate, currentDate);
    if (filterType === "weekly") return isWithinInterval(entryDate, { start: startOfWeek(currentDate), end: endOfWeek(currentDate) });
    if (filterType === "monthly") return isWithinInterval(entryDate, { start: startOfMonth(currentDate), end: endOfMonth(currentDate) });
    return true;
  });

  const totalIncome = filteredEntries.filter(e => e.type === "income").reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = filteredEntries.filter(e => e.type === "expense").reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-serif text-primary">Daybook</h1>
          <p className="text-muted-foreground">Financial Overview & Cash Flow</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">Daily</SelectItem>
              <SelectItem value="weekly">Weekly</SelectItem>
              <SelectItem value="monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-card">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">{format(currentDate, "dd MMM yyyy")}</span>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
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
        {/* Left Column: Bank Balances */}
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle className="font-serif text-lg">Bank Balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {banks.map((bank) => (
              <div key={bank.id} className="flex justify-between items-center p-3 rounded-lg bg-muted/30 border">
                <span className="font-medium">{bank.name}</span>
                <span className="font-bold font-mono">₹{bank.balance.toLocaleString()}</span>
              </div>
            ))}
            <Button variant="outline" className="w-full text-xs mt-4">+ Add Bank Account</Button>
          </CardContent>
        </Card>

        {/* Right Column: Transactions */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="font-serif text-lg">Transactions</CardTitle>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2"><Plus className="h-4 w-4"/> Add Entry</Button>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEntries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">No transactions found for this period.</TableCell>
                  </TableRow>
                ) : (
                  filteredEntries.map((entry) => (
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
                        {entry.type === "income" ? "+" : "-"}₹{entry.amount.toLocaleString()}
                      </TableCell>
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

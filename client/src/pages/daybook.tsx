import { useState, useMemo } from "react";
import type { DaybookEntry, Bank, BankTransfer, DaybookCategory, Vendor, Event } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarIcon, TrendingUp, TrendingDown, Wallet, Plus, Pencil, Trash2, ChevronLeft, ChevronRight, ArrowRightLeft, Building2, CalendarDays, Check, ChevronsUpDown, Tags } from "lucide-react";
import { format, addDays, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth, startOfYear, endOfYear, parseISO, isWithinInterval } from "date-fns";
import { useForm } from "react-hook-form";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";

export default function Daybook() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isIncomeDialogOpen, setIsIncomeDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [editingCategory, setEditingCategory] = useState<DaybookCategory | null>(null);
  const [editingEntry, setEditingEntry] = useState<DaybookEntry | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [periodType, setPeriodType] = useState<"day" | "month" | "year" | "custom">("month");
  const [customStartDate, setCustomStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [customEndDate, setCustomEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperAdmin = user?.role === 'superadmin';
  const canEditEntries = isAdmin || user?.role === 'manager' || user?.role === 'wedding_planner' || user?.role === 'accountant';

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

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Failed to fetch events');
      return res.json();
    },
  });

  const { data: categories = [] } = useQuery<DaybookCategory[]>({
    queryKey: ['/api/daybook-categories'],
    queryFn: async () => {
      const res = await fetch('/api/daybook-categories');
      if (!res.ok) throw new Error('Failed to fetch categories');
      return res.json();
    },
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ['/api/vendors'],
    queryFn: async () => {
      const res = await fetch('/api/vendors');
      if (!res.ok) throw new Error('Failed to fetch vendors');
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

  const updateEntryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<DaybookEntry> }) => {
      const res = await fetch(`/api/daybook/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update entry');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/daybook'] });
      queryClient.invalidateQueries({ queryKey: ['/api/banks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setEditingEntry(null);
      setIsEditDialogOpen(false);
      toast({
        title: "Entry Updated",
        description: "Your changes have been saved successfully.",
      });
    },
  });

  const createBankMutation = useMutation({
    mutationFn: async (data: { name: string; openingBalance: string; balance: string }) => {
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

  const createCategoryMutation = useMutation({
    mutationFn: async (data: { name: string; type: string }) => {
      const res = await fetch('/api/daybook-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create category');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/daybook-categories'] });
      setIsCategoryDialogOpen(false);
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { name: string } }) => {
      const res = await fetch(`/api/daybook-categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update category');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/daybook-categories'] });
      setEditingCategory(null);
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/daybook-categories/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete category');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/daybook-categories'] });
    },
  });

  const createVendorMutation = useMutation({
    mutationFn: async (data: Partial<Vendor>) => {
      const res = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to create vendor');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
    },
  });

  const incomeCategories = categories.filter(c => c.type === 'income');
  const expenseCategories = categories.filter(c => c.type === 'expense');

  const SimpleTransactionForm = ({ type, onClose }: { type: 'income' | 'expense'; onClose: () => void }) => {
    const { register, handleSubmit, setValue, reset, watch } = useForm<any>({
      defaultValues: {
        type,
        date: formattedDate,
      }
    });
    
    const [eventSearchOpen, setEventSearchOpen] = useState(false);
    const [eventSearch, setEventSearch] = useState("");
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [vendorSearchOpen, setVendorSearchOpen] = useState(false);
    const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
    const [showNewVendor, setShowNewVendor] = useState(false);
    const [newVendorName, setNewVendorName] = useState("");
    const [newVendorAddress, setNewVendorAddress] = useState("");
    const [newVendorCategory, setNewVendorCategory] = useState("");
    const [newVendorContact, setNewVendorContact] = useState("");
    const [showNewCategory, setShowNewCategory] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState("");
    
    const typeCategories = type === 'income' ? incomeCategories : expenseCategories;
    
    const filteredEvents = events.filter(e => 
      e.title.toLowerCase().includes(eventSearch.toLowerCase()) ||
      e.customer?.toLowerCase().includes(eventSearch.toLowerCase())
    );
    
    const onSubmit = (data: any) => {
      const submitData = {
        ...data,
        type,
        date: data.date || formattedDate,
      };
      
      createMutation.mutate(submitData, {
        onSuccess: () => {
          reset({
            type,
            date: data.date,
            amount: '',
            bankId: undefined,
            category: '',
            description: '',
          });
          setSelectedEvent(null);
          setSelectedVendor(null);
          queryClient.invalidateQueries({ queryKey: ['/api/events'] });
        }
      });
    };

    const handleCreateVendor = () => {
      if (!newVendorName.trim()) return;
      createVendorMutation.mutate({
        name: newVendorName,
        billingAddress: newVendorAddress,
        category: newVendorCategory,
        phone: newVendorContact,
      }, {
        onSuccess: (newVendor) => {
          setSelectedVendor(newVendor);
          setValue("vendorId", newVendor.id);
          setValue("vendorName", newVendor.name);
          setShowNewVendor(false);
          setNewVendorName("");
          setNewVendorAddress("");
          setNewVendorCategory("");
          setNewVendorContact("");
        }
      });
    };

    const handleCreateCategory = () => {
      if (!newCategoryName.trim()) return;
      createCategoryMutation.mutate({
        name: newCategoryName,
        type: type,
      }, {
        onSuccess: (newCat) => {
          setValue("category", newCat.name);
          setShowNewCategory(false);
          setNewCategoryName("");
        }
      });
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input 
              type="number" 
              step="0.01" 
              {...register("amount")} 
              required 
              placeholder="0.00" 
              data-testid="input-amount"
              className="text-lg font-mono"
            />
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
          <div className="flex items-center justify-between">
            <Label>Category *</Label>
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              className="h-6 text-xs"
              onClick={() => setShowNewCategory(!showNewCategory)}
            >
              <Plus className="h-3 w-3 mr-1" /> New
            </Button>
          </div>
          {showNewCategory ? (
            <div className="flex gap-2">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="Category name..."
                className="flex-1"
              />
              <Button 
                type="button" 
                size="sm" 
                onClick={handleCreateCategory}
                disabled={createCategoryMutation.isPending}
              >
                Add
              </Button>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => setShowNewCategory(false)}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <Select onValueChange={(v) => setValue("category", v)} required>
              <SelectTrigger data-testid="select-category">
                <SelectValue placeholder="Select a category..." />
              </SelectTrigger>
              <SelectContent>
                {typeCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="space-y-2">
          <Label>Link to Event (Optional - Updates Event P&L)</Label>
          <Popover open={eventSearchOpen} onOpenChange={setEventSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={eventSearchOpen}
                className="w-full justify-between font-normal"
                data-testid="select-event"
              >
                {selectedEvent ? (
                  <span>{selectedEvent.title} ({format(parseISO(selectedEvent.date), "dd MMM yyyy")})</span>
                ) : (
                  <span className="text-muted-foreground">Search events...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput 
                  placeholder="Search events..." 
                  value={eventSearch}
                  onValueChange={setEventSearch}
                />
                <CommandList>
                  <CommandEmpty>No events found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setSelectedEvent(null);
                        setValue("eventId", undefined);
                        setValue("eventName", undefined);
                        setEventSearchOpen(false);
                      }}
                    >
                      <span className="text-muted-foreground">No event</span>
                    </CommandItem>
                    {filteredEvents.map((event) => (
                      <CommandItem
                        key={event.id}
                        value={event.title}
                        onSelect={() => {
                          setSelectedEvent(event);
                          setValue("eventId", event.id);
                          setValue("eventName", event.title);
                          setEventSearchOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedEvent?.id === event.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="flex flex-col">
                          <span>{event.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(parseISO(event.date), "dd MMM yyyy")} • {event.customer}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <p className="text-xs text-muted-foreground">
            {type === 'income' 
              ? "Linking to an event will add this amount to event's Payment Received"
              : "Linking to an event will add this amount to event's Cost"
            }
          </p>
        </div>

        {type === 'expense' && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Vendor (Optional)</Label>
              <Button 
                type="button" 
                variant="ghost" 
                size="sm" 
                className="h-6 text-xs"
                onClick={() => setShowNewVendor(!showNewVendor)}
              >
                <Plus className="h-3 w-3 mr-1" /> New Vendor
              </Button>
            </div>
            
            {showNewVendor ? (
              <div className="space-y-3 p-3 border rounded-md bg-muted/30">
                <div className="space-y-2">
                  <Label className="text-xs">Vendor Name *</Label>
                  <Input
                    value={newVendorName}
                    onChange={(e) => setNewVendorName(e.target.value)}
                    placeholder="Vendor name..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Address</Label>
                  <Input
                    value={newVendorAddress}
                    onChange={(e) => setNewVendorAddress(e.target.value)}
                    placeholder="Address..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Category</Label>
                    <Input
                      value={newVendorCategory}
                      onChange={(e) => setNewVendorCategory(e.target.value)}
                      placeholder="e.g. Catering"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Contact</Label>
                    <Input
                      value={newVendorContact}
                      onChange={(e) => setNewVendorContact(e.target.value)}
                      placeholder="Phone/Email"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    size="sm" 
                    onClick={handleCreateVendor}
                    disabled={createVendorMutation.isPending || !newVendorName.trim()}
                    className="flex-1"
                  >
                    {createVendorMutation.isPending ? 'Creating...' : 'Create Vendor'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setShowNewVendor(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Select onValueChange={(v) => {
                if (v === "none") {
                  setSelectedVendor(null);
                  setValue("vendorId", undefined);
                  setValue("vendorName", undefined);
                } else {
                  const vendor = vendors.find(vn => vn.id === v);
                  if (vendor) {
                    setSelectedVendor(vendor);
                    setValue("vendorId", vendor.id);
                    setValue("vendorName", vendor.name);
                  }
                }
              }}>
                <SelectTrigger data-testid="select-vendor">
                  <SelectValue placeholder="Select a vendor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No vendor</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.id}>
                      {vendor.name} {vendor.category && `(${vendor.category})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label>Description</Label>
          <textarea 
            {...register("description")} 
            className="w-full min-h-[60px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-y"
            placeholder="Add notes or details..."
            data-testid="input-description"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Close
          </Button>
          <Button 
            type="submit" 
            className={cn("flex-1", type === 'income' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")}
            disabled={createMutation.isPending}
          >
            <Plus className="h-4 w-4 mr-1" />
            {createMutation.isPending ? 'Adding...' : `Add ${type === 'income' ? 'Income' : 'Expense'}`}
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground text-center">
          The window will stay open for multiple entries.
        </p>
      </form>
    );
  };

  const AddBankForm = () => {
    const { register, handleSubmit } = useForm<{ name: string; openingBalance: string }>();
    
    const onSubmit = (data: any) => {
      createBankMutation.mutate({
        name: data.name,
        openingBalance: data.openingBalance || '0',
        balance: data.openingBalance || '0',
      });
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label>Bank Name</Label>
          <Input {...register("name")} required placeholder="e.g. HDFC Bank" />
        </div>
        <div className="space-y-2">
          <Label>Opening Balance</Label>
          <Input type="number" step="0.01" {...register("openingBalance")} required placeholder="0" />
          <p className="text-xs text-muted-foreground">Initial balance when adding this bank account</p>
        </div>
        <Button type="submit" className="w-full" disabled={createBankMutation.isPending}>
          {createBankMutation.isPending ? 'Adding...' : 'Add Bank'}
        </Button>
      </form>
    );
  };

  const EditBankForm = ({ bank, onClose }: { bank: Bank; onClose: () => void }) => {
    const { register, handleSubmit } = useForm<{ name: string; openingBalance: string }>({
      defaultValues: { 
        name: bank.name, 
        openingBalance: (bank as any).openingBalance || bank.balance 
      }
    });
    
    const onSubmit = (data: any) => {
      const updateData: any = { name: data.name };
      if (isSuperAdmin && data.openingBalance) {
        const oldOpening = parseFloat((bank as any).openingBalance || bank.balance);
        const newOpening = parseFloat(data.openingBalance);
        const difference = newOpening - oldOpening;
        updateData.openingBalance = data.openingBalance;
        updateData.balance = (parseFloat(bank.balance) + difference).toFixed(2);
      }
      updateBankMutation.mutate({ id: bank.id, data: updateData });
    };

    return (
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label>Bank Name</Label>
          <Input {...register("name")} required />
        </div>
        {isSuperAdmin && (
          <div className="space-y-2">
            <Label>Opening Balance</Label>
            <Input type="number" step="0.01" {...register("openingBalance")} required />
            <p className="text-xs text-muted-foreground">Only superadmin can edit opening balance</p>
          </div>
        )}
        <div className="p-3 bg-muted rounded-md">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Current Balance</span>
            <span className="font-mono font-bold">₹{Number(bank.balance).toLocaleString()}</span>
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={updateBankMutation.isPending}>
          {updateBankMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>
    );
  };

  const EditEntryForm = ({ 
    entry, 
    banks, 
    events, 
    categories,
    onSubmit, 
    onCancel,
    isPending 
  }: { 
    entry: DaybookEntry;
    banks: Bank[];
    events: Event[];
    categories: DaybookCategory[];
    onSubmit: (data: Partial<DaybookEntry>) => void;
    onCancel: () => void;
    isPending: boolean;
  }) => {
    const { register, handleSubmit, setValue, watch } = useForm<any>({
      defaultValues: {
        amount: entry.amount,
        date: entry.date,
        bankId: entry.bankId || '',
        category: entry.category || '',
        description: entry.description || '',
        eventId: entry.eventId || '',
      }
    });
    
    const [eventSearchOpen, setEventSearchOpen] = useState(false);
    const [eventSearch, setEventSearch] = useState("");
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(
      entry.eventId ? events.find(e => e.id === entry.eventId) || null : null
    );
    
    const filteredEvents = events.filter(e => 
      e.title.toLowerCase().includes(eventSearch.toLowerCase()) ||
      e.customer?.toLowerCase().includes(eventSearch.toLowerCase())
    );
    
    const handleFormSubmit = (data: any) => {
      onSubmit({
        amount: data.amount,
        date: data.date,
        bankId: data.bankId || null,
        category: data.category,
        description: data.description,
        eventId: data.eventId || null,
      });
    };

    return (
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Amount *</Label>
            <Input 
              type="number" 
              step="0.01" 
              {...register("amount")} 
              required 
              placeholder="0.00" 
              data-testid="input-edit-amount"
              className="text-lg font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>Date *</Label>
            <Input 
              type="date" 
              {...register("date")} 
              required 
              data-testid="input-edit-date"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Bank *</Label>
          <Select defaultValue={entry.bankId || ''} onValueChange={(v) => setValue("bankId", v)}>
            <SelectTrigger data-testid="select-edit-bank">
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
          <Select defaultValue={entry.category || ''} onValueChange={(v) => setValue("category", v)}>
            <SelectTrigger data-testid="select-edit-category">
              <SelectValue placeholder="Select a category..." />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Link to Event (Optional)</Label>
          <Popover open={eventSearchOpen} onOpenChange={setEventSearchOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={eventSearchOpen}
                className="w-full justify-between font-normal"
                data-testid="select-edit-event"
              >
                {selectedEvent ? (
                  <span>{selectedEvent.title} ({format(parseISO(selectedEvent.date), "dd MMM yyyy")})</span>
                ) : (
                  <span className="text-muted-foreground">Search events...</span>
                )}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput 
                  placeholder="Search events..." 
                  value={eventSearch}
                  onValueChange={setEventSearch}
                />
                <CommandList>
                  <CommandEmpty>No events found.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setSelectedEvent(null);
                        setValue("eventId", "");
                        setEventSearchOpen(false);
                      }}
                    >
                      <Check className={cn("mr-2 h-4 w-4", !selectedEvent ? "opacity-100" : "opacity-0")} />
                      <span className="text-muted-foreground">No event link</span>
                    </CommandItem>
                    {filteredEvents.map((event) => (
                      <CommandItem
                        key={event.id}
                        onSelect={() => {
                          setSelectedEvent(event);
                          setValue("eventId", event.id);
                          setEventSearchOpen(false);
                        }}
                      >
                        <Check className={cn("mr-2 h-4 w-4", selectedEvent?.id === event.id ? "opacity-100" : "opacity-0")} />
                        <div className="flex flex-col">
                          <span>{event.title}</span>
                          <span className="text-xs text-muted-foreground">
                            {event.customer} - {format(parseISO(event.date), "dd MMM yyyy")}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Description</Label>
          <textarea 
            {...register("description")} 
            className="w-full min-h-[60px] px-3 py-2 rounded-md border border-input bg-background text-sm resize-y"
            placeholder="Add notes or details..."
            data-testid="input-edit-description"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            className={cn("flex-1", entry.type === 'income' ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700")}
            disabled={isPending}
          >
            <Pencil className="h-4 w-4 mr-1" />
            {isPending ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
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

  const AddCategoryForm = () => {
    const [name, setName] = useState("");
    const [type, setType] = useState<string>("income");
    
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;
      createCategoryMutation.mutate({ name: name.trim(), type });
      setName("");
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label>Category Name</Label>
          <Input 
            value={name}
            onChange={(e) => setName(e.target.value)}
            required 
            placeholder="e.g. Event Booking" 
          />
        </div>
        <div className="space-y-2">
          <Label>Category Type</Label>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Income</SelectItem>
              <SelectItem value="expense">Expense</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full" disabled={createCategoryMutation.isPending}>
          {createCategoryMutation.isPending ? 'Adding...' : 'Add Category'}
        </Button>
      </form>
    );
  };

  const EditCategoryInline = ({ category, onClose }: { category: DaybookCategory; onClose: () => void }) => {
    const [name, setName] = useState(category.name);
    
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;
      updateCategoryMutation.mutate({ id: category.id, data: { name: name.trim() } });
    };

    return (
      <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full">
        <Input 
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 text-sm flex-1"
          autoFocus
        />
        <Button type="submit" size="sm" className="h-8" disabled={updateCategoryMutation.isPending}>
          Save
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={onClose}>
          Cancel
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
        <TabsList className="grid w-full grid-cols-4 max-w-lg">
          <TabsTrigger value="daily" className="text-xs sm:text-sm">Daily View</TabsTrigger>
          <TabsTrigger value="summary" className="text-xs sm:text-sm">Summary</TabsTrigger>
          <TabsTrigger value="banks" className="text-xs sm:text-sm">Banks</TabsTrigger>
          <TabsTrigger value="categories" className="text-xs sm:text-sm">Categories</TabsTrigger>
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
                  onClick={() => setIsIncomeDialogOpen(true)}
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
                          {canEditEntries && <TableHead className="w-8"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {incomeEntries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={canEditEntries ? 4 : 3} className="text-center py-6 text-muted-foreground text-sm">No income entries for this day</TableCell>
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
                              {canEditEntries && (
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                                      onClick={() => {
                                        setEditingEntry(entry);
                                        setIsEditDialogOpen(true);
                                      }}
                                      data-testid={`button-edit-income-${entry.id}`}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    {isAdmin && (
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
                                    )}
                                  </div>
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
                  onClick={() => setIsExpenseDialogOpen(true)}
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
                          {canEditEntries && <TableHead className="w-8"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenseEntries.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={canEditEntries ? 4 : 3} className="text-center py-6 text-muted-foreground text-sm">No expense entries for this day</TableCell>
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
                              {canEditEntries && (
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                                      onClick={() => {
                                        setEditingEntry(entry);
                                        setIsEditDialogOpen(true);
                                      }}
                                      data-testid={`button-edit-expense-${entry.id}`}
                                    >
                                      <Pencil className="h-3 w-3" />
                                    </Button>
                                    {isAdmin && (
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
                                    )}
                                  </div>
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

        <TabsContent value="categories" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between p-4 sm:p-6">
              <div className="flex items-center gap-2">
                <Tags className="h-5 w-5 text-primary" />
                <CardTitle className="font-serif text-lg">Daybook Categories</CardTitle>
              </div>
              {isAdmin && (
                <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1 h-8" data-testid="button-add-category">
                      <Plus className="h-3 w-3" /> Add Category
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-[95vw] sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add New Category</DialogTitle>
                    </DialogHeader>
                    <AddCategoryForm />
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="font-medium text-green-700 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Income Categories
                  </h3>
                  <div className="space-y-2">
                    {incomeCategories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between p-3 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900">
                        {editingCategory?.id === cat.id ? (
                          <EditCategoryInline 
                            category={cat} 
                            onClose={() => setEditingCategory(null)} 
                          />
                        ) : (
                          <>
                            <span className="text-sm">{cat.name}</span>
                            {isAdmin && !cat.isSystem && (
                              <div className="flex gap-1">
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7"
                                  onClick={() => setEditingCategory(cat)}
                                  data-testid={`button-edit-category-${cat.id}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => {
                                    if (confirm(`Delete category "${cat.name}"?`)) deleteCategoryMutation.mutate(cat.id);
                                  }}
                                  data-testid={`button-delete-category-${cat.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            {cat.isSystem && (
                              <span className="text-xs text-muted-foreground">System</span>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                    {incomeCategories.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No income categories</p>
                    )}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h3 className="font-medium text-red-700 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" />
                    Expense Categories
                  </h3>
                  <div className="space-y-2">
                    {expenseCategories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between p-3 rounded-md bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
                        {editingCategory?.id === cat.id ? (
                          <EditCategoryInline 
                            category={cat} 
                            onClose={() => setEditingCategory(null)} 
                          />
                        ) : (
                          <>
                            <span className="text-sm">{cat.name}</span>
                            {isAdmin && !cat.isSystem && (
                              <div className="flex gap-1">
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7"
                                  onClick={() => setEditingCategory(cat)}
                                  data-testid={`button-edit-category-${cat.id}`}
                                >
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => {
                                    if (confirm(`Delete category "${cat.name}"?`)) deleteCategoryMutation.mutate(cat.id);
                                  }}
                                  data-testid={`button-delete-category-${cat.id}`}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                            {cat.isSystem && (
                              <span className="text-xs text-muted-foreground">System</span>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                    {expenseCategories.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No expense categories</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isIncomeDialogOpen} onOpenChange={setIsIncomeDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-serif text-green-700">Add Income</DialogTitle>
          </DialogHeader>
          <SimpleTransactionForm type="income" onClose={() => setIsIncomeDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-serif text-red-700">Add Expense</DialogTitle>
          </DialogHeader>
          <SimpleTransactionForm type="expense" onClose={() => setIsExpenseDialogOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={(open) => {
        setIsEditDialogOpen(open);
        if (!open) setEditingEntry(null);
      }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className={`text-lg font-serif ${editingEntry?.type === 'income' ? 'text-green-700' : 'text-red-700'}`}>
              Edit {editingEntry?.type === 'income' ? 'Income' : 'Expense'}
            </DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <EditEntryForm 
              entry={editingEntry} 
              banks={banks}
              events={events}
              categories={editingEntry.type === 'income' ? incomeCategories : expenseCategories}
              onSubmit={(data) => {
                updateEntryMutation.mutate({ id: editingEntry.id, data });
              }}
              onCancel={() => {
                setEditingEntry(null);
                setIsEditDialogOpen(false);
              }}
              isPending={updateEntryMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

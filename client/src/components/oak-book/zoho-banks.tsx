import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  ChevronDown,
  X,
  MoreHorizontal,
  Edit,
  Trash2,
  Landmark,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  CreditCard,
  Building2,
} from "lucide-react";
import type { Bank } from "@shared/schema";

export function ZohoBanks() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedBankId, setSelectedBankId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);

  const { data: banks = [] } = useQuery<Bank[]>({
    queryKey: ["/api/banks"],
  });

  const createBank = useMutation({
    mutationFn: (data: Partial<Bank>) => apiRequest("POST", "/api/banks", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banks"] });
      setIsCreateModalOpen(false);
      setEditingBank(null);
    },
  });

  const updateBank = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Bank> }) =>
      apiRequest("PATCH", `/api/banks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banks"] });
      setIsCreateModalOpen(false);
      setEditingBank(null);
    },
  });

  const deleteBank = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/banks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/banks"] });
      setSelectedBankId(null);
    },
  });

  const filteredBanks = banks.filter((bank) =>
    bank.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedBank = banks.find((b) => b.id === selectedBankId);
  const totalBalance = banks.reduce((sum, b) => sum + parseFloat(b.balance || "0"), 0);

  return (
    <div className="flex h-[calc(100vh-120px)] bg-white rounded-lg border overflow-hidden">
      <div className={cn("flex flex-col transition-all w-full", selectedBankId ? "md:w-[calc(100%-480px)]" : "w-full")}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 border-b gap-3">
          <div className="flex items-center justify-between sm:justify-start gap-2 sm:gap-4">
            <h2 className="text-base sm:text-xl font-semibold text-gray-900">Bank Accounts</h2>
            <Badge variant="secondary" className="rounded-full hidden sm:inline-flex">
              {filteredBanks.length}
            </Badge>
            <Button 
              onClick={() => setIsCreateModalOpen(true)} 
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 h-8 sm:hidden ml-auto"
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full sm:w-48 lg:w-64 h-9"
              />
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 hidden sm:flex">
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
        </div>

        <div className={cn(
          "grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4 bg-gray-50 border-b",
          selectedBankId && "hidden md:grid"
        )}>
          <div className="bg-white p-3 sm:p-4 rounded-lg border">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-gray-400" />
              <span className="text-xs sm:text-sm text-gray-600">Total Balance</span>
            </div>
            <p className="text-lg sm:text-2xl font-bold text-gray-900">
              ₹{totalBalance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg border hidden sm:block">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-gray-600">Bank Accounts</span>
            </div>
            <p className="text-2xl font-bold text-blue-600">{banks.length}</p>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg border hidden sm:block">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="h-4 w-4 text-green-500" />
              <span className="text-sm text-gray-600">Active</span>
            </div>
            <p className="text-2xl font-bold text-green-600">{banks.length}</p>
          </div>
        </div>

        <div className={cn(
          "flex-1 overflow-auto bg-gray-50",
          selectedBankId && "hidden md:block"
        )}>
          <div className="md:hidden divide-y">
            {filteredBanks.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Landmark className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No bank accounts found</p>
                <p className="text-sm mt-1">Add your first bank account to get started</p>
              </div>
            ) : (
              filteredBanks.map((bank) => {
                const openingBal = parseFloat(bank.openingBalance || "0");
                const currentBal = parseFloat(bank.balance || "0");
                const change = currentBal - openingBal;
                
                return (
                  <div
                    key={bank.id}
                    onClick={() => setSelectedBankId(bank.id)}
                    className={cn(
                      "p-4 cursor-pointer transition-colors active:bg-blue-50/50",
                      selectedBankId === bank.id && "bg-blue-50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                          <Landmark className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-blue-600 truncate">{bank.name}</p>
                          <p className="text-xs text-gray-500">
                            {bank.createdAt ? format(new Date(bank.createdAt), "dd MMM yyyy") : "—"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold">₹{currentBal.toLocaleString("en-IN")}</p>
                        {change !== 0 && (
                          <p className={cn("text-xs", change > 0 ? "text-green-600" : "text-red-600")}>
                            {change > 0 ? "+" : ""}₹{Math.abs(change).toLocaleString("en-IN")}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <table className="w-full hidden md:table">
            <thead className="bg-gray-100 sticky top-0">
              <tr className="text-left text-sm text-gray-600">
                <th className="p-3 w-10">
                  <Checkbox />
                </th>
                <th className="p-3 font-medium">BANK NAME</th>
                <th className="p-3 font-medium text-right">OPENING BALANCE</th>
                <th className="p-3 font-medium text-right">CURRENT BALANCE</th>
                <th className="p-3 font-medium">CREATED</th>
              </tr>
            </thead>
            <tbody>
              {filteredBanks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-gray-500">
                    <Landmark className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p>No bank accounts found</p>
                    <p className="text-sm mt-1">Add your first bank account to get started</p>
                  </td>
                </tr>
              ) : (
                filteredBanks.map((bank) => {
                  const openingBal = parseFloat(bank.openingBalance || "0");
                  const currentBal = parseFloat(bank.balance || "0");
                  const change = currentBal - openingBal;
                  
                  return (
                    <tr
                      key={bank.id}
                      onClick={() => setSelectedBankId(bank.id)}
                      className={cn(
                        "border-b border-gray-100 cursor-pointer hover:bg-blue-50/50 transition-colors",
                        selectedBankId === bank.id && "bg-blue-50"
                      )}
                    >
                      <td className="p-3" onClick={(e) => e.stopPropagation()}>
                        <Checkbox />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <Landmark className="h-5 w-5 text-blue-600" />
                          </div>
                          <span className="text-blue-600 hover:underline font-medium">{bank.name}</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-right text-gray-600">
                        ₹{openingBal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-medium">
                            ₹{currentBal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                          </span>
                          {change !== 0 && (
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-xs",
                                change > 0 ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"
                              )}
                            >
                              {change > 0 ? (
                                <TrendingUp className="h-3 w-3 mr-1" />
                              ) : (
                                <TrendingDown className="h-3 w-3 mr-1" />
                              )}
                              {change > 0 ? "+" : ""}
                              ₹{Math.abs(change).toLocaleString("en-IN")}
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-sm text-gray-600">
                        {bank.createdAt ? format(new Date(bank.createdAt), "dd MMM yyyy") : "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className={cn(
          "p-3 border-t bg-white text-sm text-gray-500",
          selectedBankId && "hidden md:block"
        )}>
          Showing {filteredBanks.length} account{filteredBanks.length !== 1 ? "s" : ""}
        </div>
      </div>

      {selectedBank && (
        <BankDetailPanel
          bank={selectedBank}
          onClose={() => setSelectedBankId(null)}
          onEdit={() => {
            setEditingBank(selectedBank);
            setIsCreateModalOpen(true);
          }}
          onDelete={() => deleteBank.mutate(selectedBank.id)}
        />
      )}

      <BankFormModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          setEditingBank(null);
        }}
        editingBank={editingBank}
        onSubmit={(data) => {
          if (editingBank) {
            updateBank.mutate({ id: editingBank.id, data });
          } else {
            createBank.mutate(data);
          }
        }}
        isSubmitting={createBank.isPending || updateBank.isPending}
      />
    </div>
  );
}

function BankDetailPanel({
  bank,
  onClose,
  onEdit,
  onDelete,
}: {
  bank: Bank;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const openingBal = parseFloat(bank.openingBalance || "0");
  const currentBal = parseFloat(bank.balance || "0");
  const change = currentBal - openingBal;

  return (
    <div className="fixed inset-0 md:right-0 md:left-auto md:top-0 h-full w-full md:w-[480px] bg-white md:border-l shadow-lg flex flex-col z-50">
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Landmark className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{bank.name}</h3>
              <p className="text-sm text-gray-500">Bank Account</p>
            </div>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={onDelete} className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 p-3 border-b bg-white">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Edit className="h-4 w-4 mr-1" />
          Edit
        </Button>
        <Button variant="outline" size="sm">
          <ArrowUpRight className="h-4 w-4 mr-1" />
          Transfer Money
        </Button>
      </div>

      <div className="p-4 bg-blue-50 border-b border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-600 uppercase font-medium">Current Balance</p>
            <p className="text-2xl font-bold text-blue-700">
              ₹{currentBal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </p>
          </div>
          {change !== 0 && (
            <Badge
              variant="outline"
              className={cn(
                "font-medium",
                change > 0 ? "text-green-600 border-green-200 bg-green-50" : "text-red-600 border-red-200 bg-red-50"
              )}
            >
              {change > 0 ? <TrendingUp className="h-4 w-4 mr-1" /> : <TrendingDown className="h-4 w-4 mr-1" />}
              {change > 0 ? "+" : ""}₹{Math.abs(change).toLocaleString("en-IN")}
            </Badge>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase mb-1">Opening Balance</p>
              <p className="text-lg font-semibold">
                ₹{openingBal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase mb-1">Net Change</p>
              <p className={cn("text-lg font-semibold", change >= 0 ? "text-green-600" : "text-red-600")}>
                {change >= 0 ? "+" : ""}₹{change.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 uppercase mb-2">Created</p>
            <p className="text-sm text-gray-700">
              {bank.createdAt ? format(new Date(bank.createdAt), "dd MMM yyyy 'at' hh:mm a") : "—"}
            </p>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Recent Transactions</h4>
            <div className="text-center py-8 text-gray-500">
              <CreditCard className="h-8 w-8 mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No recent transactions</p>
            </div>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function BankFormModal({
  isOpen,
  onClose,
  editingBank,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  editingBank: Bank | null;
  onSubmit: (data: Partial<Bank>) => void;
  isSubmitting: boolean;
}) {
  const [formData, setFormData] = useState({
    name: "",
    openingBalance: "",
    balance: "",
  });

  useEffect(() => {
    if (editingBank) {
      setFormData({
        name: editingBank.name || "",
        openingBalance: editingBank.openingBalance || "",
        balance: editingBank.balance || "",
      });
    } else {
      setFormData({
        name: "",
        openingBalance: "",
        balance: "",
      });
    }
  }, [editingBank]);

  const handleSubmit = () => {
    const data = {
      name: formData.name,
      openingBalance: formData.openingBalance || "0",
      balance: formData.balance || formData.openingBalance || "0",
    };
    onSubmit(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editingBank ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Bank Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., HDFC Bank, SBI"
              className="mt-1"
            />
          </div>

          <div>
            <Label>Opening Balance</Label>
            <Input
              type="number"
              value={formData.openingBalance}
              onChange={(e) => setFormData({ ...formData, openingBalance: e.target.value })}
              placeholder="0.00"
              className="mt-1"
            />
            <p className="text-xs text-gray-500 mt-1">Balance when you started using this account</p>
          </div>

          <div>
            <Label>Current Balance</Label>
            <Input
              type="number"
              value={formData.balance}
              onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
              placeholder="0.00"
              className="mt-1"
            />
            {!editingBank && (
              <p className="text-xs text-gray-500 mt-1">Leave empty to use opening balance as current balance</p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !formData.name}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {editingBank ? "Update" : "Add Account"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

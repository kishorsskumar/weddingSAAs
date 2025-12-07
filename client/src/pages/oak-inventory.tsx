import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import {
  LayoutDashboard,
  Package,
  Boxes,
  Truck,
  FileText,
  ClipboardList,
  Factory,
  Plus,
  Search,
  Edit,
  Trash2,
  ChevronRight,
  Menu,
  X,
  ArrowUp,
  ArrowDown,
  AlertTriangle,
  Calendar,
  Users,
  Building2,
  CheckCircle,
  Clock,
  PackageOpen,
  Eye,
  Download,
  Copy,
  RotateCcw,
  Printer,
  Check,
  XCircle,
  ChevronsUpDown
} from "lucide-react";
import type {
  InventoryItem,
  InventoryTransaction,
  EventInventorySession,
  EventInventoryItem,
  RentalRecord,
  RentalItem,
  InventoryTemplate,
  InventoryTemplateItem,
  PurchaseOrder,
  PurchaseOrderItem,
  ProductionPlan,
  ProductionTask,
  Event,
  Vendor,
  User,
  CompanySettings
} from "@shared/schema";

const COMPANY_DEFAULTS = {
  companyName: 'Oakstreet Events',
  address: '2nd Floor, Above Devas Studio\nDeshabhimani press road\nKochi Kerala 682017\nIndia',
  phone: '7902373354',
  email: 'oakstreetevents18@gmail.com',
  gstNumber: '',
};

type Section = 'items' | 'event-inventory' | 'rentals' | 'templates' | 'purchase-orders' | 'production-plans';

const DEFAULT_CATEGORIES = ["Décor", "Furniture", "Lighting", "Linens", "Props", "Florals", "Electronics", "Other"];
const EVENT_TYPES = ["Wedding Stage Décor", "Reception Setup", "Corporate Event", "Birthday Party", "Other"];
const SESSION_STATUSES = ["draft", "issued", "partial_return", "completed"];
const RENTAL_STATUSES = ["active", "returned", "partial", "overdue"];
const PO_STATUSES = ["draft", "sent", "confirmed", "received", "cancelled"];
const PLAN_STATUSES = ["draft", "active", "completed"];
const TASK_STATUSES = ["pending", "in_progress", "completed"];

const formatCurrency = (amount: string | number | null) => {
  if (!amount) return '₹0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
};

const sidebarItems = [
  { id: 'items', label: 'Inventory Items', icon: Package },
  { id: 'event-inventory', label: 'Event Inventory', icon: Boxes },
  { id: 'rentals', label: 'Rentals', icon: Truck },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'purchase-orders', label: 'Purchase Orders', icon: ClipboardList },
  { id: 'production-plans', label: 'Production Plans', icon: Factory },
];

export default function OakInventory() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState<Section>('items');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory/items'],
  });

  const { data: inventorySessions = [] } = useQuery<EventInventorySession[]>({
    queryKey: ['/api/inventory/sessions'],
  });

  const { data: sessionItems = [] } = useQuery<EventInventoryItem[]>({
    queryKey: ['/api/inventory/session-items'],
  });

  const { data: rentals = [] } = useQuery<RentalRecord[]>({
    queryKey: ['/api/inventory/rentals'],
  });

  const { data: rentalItems = [] } = useQuery<RentalItem[]>({
    queryKey: ['/api/inventory/rental-items'],
  });

  const { data: templates = [] } = useQuery<InventoryTemplate[]>({
    queryKey: ['/api/inventory/templates'],
  });

  const { data: templateItems = [] } = useQuery<InventoryTemplateItem[]>({
    queryKey: ['/api/inventory/template-items'],
  });

  const { data: purchaseOrders = [] } = useQuery<PurchaseOrder[]>({
    queryKey: ['/api/inventory/purchase-orders'],
  });

  const { data: poItems = [] } = useQuery<PurchaseOrderItem[]>({
    queryKey: ['/api/inventory/po-items'],
  });

  const { data: productionPlans = [] } = useQuery<ProductionPlan[]>({
    queryKey: ['/api/inventory/production-plans'],
  });

  const { data: productionTasks = [] } = useQuery<ProductionTask[]>({
    queryKey: ['/api/inventory/production-tasks'],
  });

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  const { data: vendors = [] } = useQuery<Vendor[]>({
    queryKey: ['/api/vendors'],
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ['/api/users'],
  });

  const handleNavClick = (sectionId: Section) => {
    setActiveSection(sectionId);
    setMobileMenuOpen(false);
  };

  const renderSidebar = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-4 border-b border-sidebar-border">
        <Link href="/" className="flex items-center gap-2 text-sidebar-foreground/80 hover:text-primary transition-colors mb-3">
          <LayoutDashboard className="h-4 w-4" />
          {!sidebarCollapsed && <span className="text-sm font-medium">Dashboard</span>}
        </Link>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-amber-600 rounded-lg flex items-center justify-center">
            <Package className="w-5 h-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div>
              <h1 className="font-semibold text-lg">Oak Inventory</h1>
              <p className="text-xs text-sidebar-foreground/60">Stock & Equipment</p>
            </div>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-1">
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id as Section)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                activeSection === item.id
                  ? 'bg-amber-600/10 text-amber-600 font-medium'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
              data-testid={`nav-${item.id}`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          ))}
        </nav>
      </ScrollArea>
      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-full justify-center"
          data-testid="button-collapse-sidebar"
        >
          <ChevronRight className={`w-4 h-4 transition-transform ${sidebarCollapsed ? '' : 'rotate-180'}`} />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-background">
      {isMobile ? (
        <>
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent side="left" className="p-0 w-72">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation Menu</SheetTitle>
              </SheetHeader>
              {renderSidebar()}
            </SheetContent>
          </Sheet>
          <div className="fixed top-0 left-0 right-0 z-40 bg-background border-b p-3 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(true)} data-testid="button-mobile-menu">
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-amber-600" />
              <span className="font-semibold">Oak Inventory</span>
            </div>
            <div className="w-10" />
          </div>
        </>
      ) : (
        <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} bg-card border-r transition-all duration-300 flex flex-col`}>
          {renderSidebar()}
        </aside>
      )}

      <main className={`flex-1 overflow-auto ${isMobile ? 'pt-16' : ''}`}>
        <div className="p-6">
          {activeSection === 'items' && (
            <InventoryItemsSection
              items={inventoryItems}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
            />
          )}
          {activeSection === 'event-inventory' && (
            <EventInventorySection
              sessions={inventorySessions}
              sessionItems={sessionItems}
              inventoryItems={inventoryItems}
              events={events}
            />
          )}
          {activeSection === 'rentals' && (
            <RentalsSection
              rentals={rentals}
              rentalItems={rentalItems}
              vendors={vendors}
              events={events}
            />
          )}
          {activeSection === 'templates' && (
            <TemplatesSection
              templates={templates}
              templateItems={templateItems}
              inventoryItems={inventoryItems}
            />
          )}
          {activeSection === 'purchase-orders' && (
            <PurchaseOrdersSection
              purchaseOrders={purchaseOrders}
              poItems={poItems}
              vendors={vendors}
              events={events}
              inventoryItems={inventoryItems}
            />
          )}
          {activeSection === 'production-plans' && (
            <ProductionPlansSection
              plans={productionPlans}
              tasks={productionTasks}
              events={events}
              vendors={vendors}
              users={users}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function InventoryItemsSection({
  items,
  searchQuery,
  setSearchQuery,
}: {
  items: InventoryItem[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem('oak-inventory-categories');
    return saved ? JSON.parse(saved) : [];
  });

  const allCategories = useMemo(() => {
    const categoriesFromItems = Array.from(new Set(items.map(item => item.category).filter(Boolean)));
    const combined = Array.from(new Set([...DEFAULT_CATEGORIES, ...customCategories, ...categoriesFromItems]));
    return combined.sort();
  }, [items, customCategories]);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'Other',
    sku: '',
    unitCost: '',
    stockQuantity: '',
    minStockLevel: '',
    location: '',
    photos: '',
    isActive: true,
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'Other',
      sku: '',
      unitCost: '',
      stockQuantity: '',
      minStockLevel: '',
      location: '',
      photos: '',
      isActive: true,
    });
    setEditingItem(null);
  };

  const handleAddCategory = () => {
    if (newCategory.trim() && !allCategories.includes(newCategory.trim())) {
      const updated = [...customCategories, newCategory.trim()];
      setCustomCategories(updated);
      localStorage.setItem('oak-inventory-categories', JSON.stringify(updated));
      toast({ title: `Category "${newCategory.trim()}" added` });
      setNewCategory('');
    }
  };

  const handleRemoveCategory = (cat: string) => {
    if (DEFAULT_CATEGORIES.includes(cat)) {
      toast({ title: 'Cannot remove default categories', variant: 'destructive' });
      return;
    }
    const updated = customCategories.filter(c => c !== cat);
    setCustomCategories(updated);
    localStorage.setItem('oak-inventory-categories', JSON.stringify(updated));
    toast({ title: `Category "${cat}" removed` });
  };

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const matchesSearch = !searchQuery || 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.location && item.location.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [items, searchQuery, categoryFilter]);

  const createItemMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/inventory/items', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/items'] });
      setIsModalOpen(false);
      resetForm();
      toast({ title: 'Inventory item created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create item', description: error.message, variant: 'destructive' });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest('PATCH', `/api/inventory/items/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/items'] });
      setIsModalOpen(false);
      resetForm();
      toast({ title: 'Inventory item updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update item', description: error.message, variant: 'destructive' });
    },
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/inventory/items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/items'] });
      toast({ title: 'Inventory item deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete item', description: error.message, variant: 'destructive' });
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: async ({ itemId, type, quantity }: { itemId: string; type: 'in' | 'out'; quantity: number }) => {
      return apiRequest('POST', '/api/inventory/transactions', {
        itemId,
        type,
        quantity,
        notes: `Quick stock ${type === 'in' ? 'addition' : 'reduction'}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/items'] });
      toast({ title: 'Stock adjusted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to adjust stock', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      description: formData.description || null,
      category: formData.category,
      sku: formData.sku || `SKU-${Date.now()}`,
      unitCost: formData.unitCost || '0',
      stockQuantity: parseInt(formData.stockQuantity) || 0,
      minStockLevel: parseInt(formData.minStockLevel) || 0,
      location: formData.location || null,
      photos: formData.photos ? formData.photos.split(',').map(p => p.trim()).filter(Boolean) : [],
      isActive: formData.isActive,
    };

    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data });
    } else {
      createItemMutation.mutate(data);
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      description: item.description || '',
      category: item.category || 'Other',
      sku: item.sku || '',
      unitCost: item.unitCost || '',
      stockQuantity: String(item.stockQuantity || 0),
      minStockLevel: String(item.minStockLevel || 0),
      location: item.location || '',
      photos: item.photos?.join(', ') || '',
      isActive: item.isActive !== false,
    });
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const lowStockCount = items.filter(i => i.stockQuantity < (i.minStockLevel || 0)).length;
  const totalItems = items.length;
  const activeItems = items.filter(i => i.isActive).length;

  const handleDownloadExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const data = filteredItems.map((item, index) => ({
        'SL No': index + 1,
        'Item Name': item.name,
        'Category': item.category,
        'SKU': item.sku || '',
        'Stock Qty': item.stockQuantity,
        'Min Level': item.minStockLevel || 0,
        'Unit Cost': item.unitCost || '0',
        'Location': item.location || '',
        'Status': item.isActive ? 'Active' : 'Inactive',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
      ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 20 }, { wch: 10 }];
      XLSX.writeFile(wb, `Inventory_Items_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast({ title: 'Excel downloaded successfully' });
    } catch (error) {
      toast({ title: 'Failed to download', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Inventory Items</h1>
          <p className="text-muted-foreground">Manage your equipment and materials</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsCategoryModalOpen(true)} data-testid="button-manage-categories">
            <Edit className="w-4 h-4 mr-2" />
            Categories
          </Button>
          <Button variant="outline" onClick={handleDownloadExcel} data-testid="button-download-inventory">
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
          <Button onClick={handleAddNew} data-testid="button-add-item">
            <Plus className="w-4 h-4 mr-2" />
            Add Item
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="text-2xl font-bold" data-testid="text-total-items">{totalItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Items</p>
                <p className="text-2xl font-bold" data-testid="text-active-items">{activeItems}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${lowStockCount > 0 ? 'bg-red-100' : 'bg-gray-100'}`}>
                <AlertTriangle className={`w-6 h-6 ${lowStockCount > 0 ? 'text-red-600' : 'text-gray-600'}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Low Stock</p>
                <p className="text-2xl font-bold" data-testid="text-low-stock">{lowStockCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search items by name, SKU, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
                data-testid="input-search-items"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-category-filter">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {allCategories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setIsCategoryModalOpen(true)} data-testid="button-manage-categories">
              <Plus className="w-4 h-4 mr-1" />
              Categories
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Stock Qty</TableHead>
                  <TableHead className="text-right">Min Stock</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No inventory items found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => {
                    const isLowStock = item.stockQuantity < (item.minStockLevel || 0);
                    return (
                      <TableRow key={item.id} data-testid={`row-item-${item.id}`}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.category}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{item.sku || '-'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => adjustStockMutation.mutate({ itemId: item.id, type: 'out', quantity: 1 })}
                              disabled={item.stockQuantity <= 0}
                              data-testid={`button-stock-out-${item.id}`}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                            <span className={isLowStock ? 'text-red-600 font-semibold' : ''}>
                              {item.stockQuantity}
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => adjustStockMutation.mutate({ itemId: item.id, type: 'in', quantity: 1 })}
                              data-testid={`button-stock-in-${item.id}`}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{item.minStockLevel || 0}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unitCost)}</TableCell>
                        <TableCell>{item.location || '-'}</TableCell>
                        <TableCell>
                          {isLowStock && (
                            <Badge variant="destructive" className="mr-1">Low Stock</Badge>
                          )}
                          {item.isActive ? (
                            <Badge variant="default">Active</Badge>
                          ) : (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleEdit(item)}
                              data-testid={`button-edit-item-${item.id}`}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteItemMutation.mutate(item.id)}
                              data-testid={`button-delete-item-${item.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Inventory Item' : 'Add Inventory Item'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  data-testid="input-item-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category *</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger data-testid="select-item-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                data-testid="input-item-description"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  data-testid="input-item-sku"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitCost">Unit Cost (₹)</Label>
                <Input
                  id="unitCost"
                  type="number"
                  step="0.01"
                  value={formData.unitCost}
                  onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                  data-testid="input-item-cost"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="stockQuantity">Stock Quantity *</Label>
                <Input
                  id="stockQuantity"
                  type="number"
                  value={formData.stockQuantity}
                  onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                  required
                  data-testid="input-item-stock"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="minStockLevel">Min Stock Level</Label>
                <Input
                  id="minStockLevel"
                  type="number"
                  value={formData.minStockLevel}
                  onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                  data-testid="input-item-min-stock"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="e.g., Warehouse A, Shelf 3"
                data-testid="input-item-location"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="photos">Photo URLs (comma-separated)</Label>
              <Input
                id="photos"
                value={formData.photos}
                onChange={(e) => setFormData({ ...formData, photos: e.target.value })}
                placeholder="https://example.com/photo1.jpg, https://example.com/photo2.jpg"
                data-testid="input-item-photos"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="rounded"
                data-testid="checkbox-item-active"
              />
              <Label htmlFor="isActive">Item is active</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createItemMutation.isPending || updateItemMutation.isPending} data-testid="button-submit-item">
                {editingItem ? 'Update Item' : 'Add Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Manage Categories</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="New category name..."
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                data-testid="input-new-category"
              />
              <Button onClick={handleAddCategory} data-testid="button-add-category">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            <div className="max-h-64 overflow-y-auto space-y-2">
              {allCategories.map((cat) => (
                <div key={cat} className="flex items-center justify-between p-2 border rounded">
                  <span>{cat}</span>
                  {!DEFAULT_CATEGORIES.includes(cat) && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500"
                      onClick={() => handleRemoveCategory(cat)}
                      data-testid={`button-remove-category-${cat}`}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsCategoryModalOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventInventorySection({
  sessions,
  sessionItems,
  inventoryItems,
  events,
}: {
  sessions: EventInventorySession[];
  sessionItems: EventInventoryItem[];
  inventoryItems: InventoryItem[];
  events: Event[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<EventInventorySession | null>(null);
  const [selectedSession, setSelectedSession] = useState<EventInventorySession | null>(null);

  const [formData, setFormData] = useState({
    eventId: '',
    status: 'draft',
    notes: '',
  });

  const [itemFormData, setItemFormData] = useState({
    itemId: '',
    quantityIssued: '',
    quantityReturned: '',
    quantityDamaged: '',
    quantityLost: '',
    damageNotes: '',
  });

  const [editingItem, setEditingItem] = useState<EventInventoryItem | null>(null);
  const [isDeliveryNoteOpen, setIsDeliveryNoteOpen] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [eventSearchOpen, setEventSearchOpen] = useState(false);
  const [eventSearchValue, setEventSearchValue] = useState('');
  const [itemSearchOpen, setItemSearchOpen] = useState(false);
  const [itemSearchValue, setItemSearchValue] = useState('');
  const [cloneEventSearchOpen, setCloneEventSearchOpen] = useState(false);
  const [cloneEventSearchValue, setCloneEventSearchValue] = useState('');

  const filteredEvents = useMemo(() => {
    if (!eventSearchValue) return events;
    const search = eventSearchValue.toLowerCase();
    return events.filter(e => 
      e.title?.toLowerCase().includes(search) || 
      e.customer?.toLowerCase().includes(search)
    );
  }, [events, eventSearchValue]);

  const filteredInventoryItems = useMemo(() => {
    if (!itemSearchValue) return inventoryItems;
    const search = itemSearchValue.toLowerCase();
    return inventoryItems.filter(item => 
      item.name?.toLowerCase().includes(search) ||
      item.category?.toLowerCase().includes(search)
    );
  }, [inventoryItems, itemSearchValue]);

  const filteredCloneEvents = useMemo(() => {
    const availableEvents = events.filter(e => e.id !== selectedSession?.eventId);
    if (!cloneEventSearchValue) return availableEvents;
    const search = cloneEventSearchValue.toLowerCase();
    return availableEvents.filter(e => 
      e.title?.toLowerCase().includes(search) || 
      e.customer?.toLowerCase().includes(search)
    );
  }, [events, selectedSession?.eventId, cloneEventSearchValue]);

  const createSessionMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/inventory/sessions', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/sessions'] });
      setIsModalOpen(false);
      toast({ title: 'Session created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create session', description: error.message, variant: 'destructive' });
    },
  });

  const updateSessionMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest('PATCH', `/api/inventory/sessions/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/sessions'] });
      setIsModalOpen(false);
      toast({ title: 'Session updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update session', description: error.message, variant: 'destructive' });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/inventory/sessions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/sessions'] });
      toast({ title: 'Session deleted' });
    },
  });

  const addSessionItemMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/inventory/session-items', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/session-items'] });
      setIsItemModalOpen(false);
      toast({ title: 'Item added to session' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to add item', description: error.message, variant: 'destructive' });
    },
  });

  const deleteSessionItemMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/inventory/session-items/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/session-items'] });
      toast({ title: 'Item removed from session' });
    },
  });

  const updateSessionItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest('PATCH', `/api/inventory/session-items/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/session-items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/items'] });
      setEditingItem(null);
      toast({ title: 'Item updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update item', description: error.message, variant: 'destructive' });
    },
  });

  const cloneSessionMutation = useMutation({
    mutationFn: async ({ sourceSessionId, newEventId }: { sourceSessionId: string; newEventId: string }) => {
      const sourceItems = sessionItems.filter(si => si.sessionId === sourceSessionId);
      const newSessionRes = await apiRequest('POST', '/api/inventory/sessions', { eventId: newEventId, status: 'draft', notes: 'Cloned from another event' });
      const newSession = newSessionRes as unknown as EventInventorySession;
      for (const item of sourceItems) {
        await apiRequest('POST', '/api/inventory/session-items', {
          sessionId: newSession.id,
          itemId: item.itemId,
          quantityIssued: item.quantityIssued,
          quantityReturned: 0,
          quantityDamaged: 0,
          quantityLost: 0,
          damageNotes: '',
        });
      }
      return newSession;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/sessions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/session-items'] });
      toast({ title: 'Session cloned successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to clone session', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSession) {
      updateSessionMutation.mutate({ id: editingSession.id, data: formData });
    } else {
      createSessionMutation.mutate(formData);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession) return;
    addSessionItemMutation.mutate({
      sessionId: selectedSession.id,
      ...itemFormData,
      quantityIssued: parseInt(itemFormData.quantityIssued) || 0,
      quantityReturned: parseInt(itemFormData.quantityReturned) || 0,
      quantityDamaged: parseInt(itemFormData.quantityDamaged) || 0,
      quantityLost: parseInt(itemFormData.quantityLost) || 0,
    });
  };

  const getEventName = (eventId: string | null) => {
    if (!eventId) return 'N/A';
    const event = events.find(e => e.id === eventId);
    return event?.title || 'Unknown Event';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary">Draft</Badge>;
      case 'issued': return <Badge variant="default" className="bg-blue-500">Issued</Badge>;
      case 'partial_return': return <Badge variant="default" className="bg-amber-500">Partial Return</Badge>;
      case 'completed': return <Badge variant="default" className="bg-green-500">Completed</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const sessionItemsForSelected = selectedSession 
    ? sessionItems.filter(si => si.sessionId === selectedSession.id) 
    : [];

  const getItemDetails = (itemId: string) => {
    return inventoryItems.find(i => i.id === itemId);
  };

  const handleDownloadDeliveryNotePDF = async () => {
    if (!selectedSession) return;
    try {
      const jsPDF = (await import('jspdf')).default;
      const eventName = getEventName(selectedSession.eventId);
      const event = events.find(e => e.id === selectedSession.eventId);
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 15;
      
      doc.setFontSize(20);
      doc.setTextColor(180, 120, 60);
      doc.text(COMPANY_DEFAULTS.companyName, pageWidth / 2, y, { align: 'center' });
      y += 8;
      
      doc.setFontSize(9);
      doc.setTextColor(100);
      const addressLines = COMPANY_DEFAULTS.address.split('\n');
      addressLines.forEach(line => {
        doc.text(line, pageWidth / 2, y, { align: 'center' });
        y += 4;
      });
      doc.text(`Phone: ${COMPANY_DEFAULTS.phone} | Email: ${COMPANY_DEFAULTS.email}`, pageWidth / 2, y, { align: 'center' });
      y += 6;
      if (COMPANY_DEFAULTS.gstNumber) {
        doc.text(`GSTIN: ${COMPANY_DEFAULTS.gstNumber}`, pageWidth / 2, y, { align: 'center' });
        y += 6;
      }
      
      doc.setDrawColor(200);
      doc.line(15, y, pageWidth - 15, y);
      y += 10;
      
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text('DELIVERY NOTE', pageWidth / 2, y, { align: 'center' });
      y += 12;
      
      doc.setFontSize(10);
      doc.setTextColor(0);
      const leftCol = 15;
      const rightCol = pageWidth / 2 + 10;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Event:', leftCol, y);
      doc.setFont('helvetica', 'normal');
      doc.text(eventName, leftCol + 25, y);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Note #:', rightCol, y);
      doc.setFont('helvetica', 'normal');
      doc.text(`DN-${selectedSession.id.slice(0, 8).toUpperCase()}`, rightCol + 25, y);
      y += 6;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Date:', leftCol, y);
      doc.setFont('helvetica', 'normal');
      doc.text(selectedSession.issuedAt ? format(new Date(selectedSession.issuedAt), 'dd/MM/yyyy') : format(new Date(), 'dd/MM/yyyy'), leftCol + 25, y);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Status:', rightCol, y);
      doc.setFont('helvetica', 'normal');
      doc.text(selectedSession.status.replace('_', ' ').toUpperCase(), rightCol + 25, y);
      y += 6;
      
      if (event?.venue) {
        doc.setFont('helvetica', 'bold');
        doc.text('Venue:', leftCol, y);
        doc.setFont('helvetica', 'normal');
        doc.text(event.venue, leftCol + 25, y);
        y += 6;
      }
      
      if (deliveryLocation) {
        doc.setFont('helvetica', 'bold');
        doc.text('Delivery To:', leftCol, y);
        doc.setFont('helvetica', 'normal');
        const locLines = doc.splitTextToSize(deliveryLocation, 80);
        doc.text(locLines, leftCol + 30, y);
        y += locLines.length * 5;
      }
      
      if (contactPerson) {
        doc.setFont('helvetica', 'bold');
        doc.text('Contact:', leftCol, y);
        doc.setFont('helvetica', 'normal');
        doc.text(`${contactPerson}${contactPhone ? ' - ' + contactPhone : ''}`, leftCol + 25, y);
        y += 6;
      }
      
      y += 8;
      
      doc.setFillColor(253, 246, 227);
      doc.rect(15, y - 5, pageWidth - 30, 8, 'F');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('SL', 18, y);
      doc.text('Item Description', 30, y);
      doc.text('Category', 100, y);
      doc.text('Qty', 140, y);
      doc.text('Returned', 158, y);
      doc.text('Status', 180, y);
      y += 8;
      
      doc.setFont('helvetica', 'normal');
      sessionItemsForSelected.forEach((si, index) => {
        const item = inventoryItems.find(i => i.id === si.itemId);
        const status = si.quantityReturned === si.quantityIssued ? 'Returned' : 
                      (si.quantityDamaged || si.quantityLost) ? 'Damaged' : 'Issued';
        
        if (y > 260) {
          doc.addPage();
          y = 20;
        }
        
        doc.text(String(index + 1), 18, y);
        doc.text((item?.name || 'Unknown').substring(0, 35), 30, y);
        doc.text((item?.category || '-').substring(0, 15), 100, y);
        doc.text(String(si.quantityIssued), 140, y);
        doc.text(String(si.quantityReturned || 0), 158, y);
        doc.text(status, 180, y);
        y += 6;
      });
      
      y += 5;
      doc.setDrawColor(200);
      doc.line(15, y, pageWidth - 15, y);
      y += 8;
      
      doc.setFontSize(9);
      doc.text(`Total Items: ${sessionItemsForSelected.length}`, 15, y);
      const totalQty = sessionItemsForSelected.reduce((sum, si) => sum + (si.quantityIssued || 0), 0);
      doc.text(`Total Quantity: ${totalQty}`, 80, y);
      y += 15;
      
      if (y > 240) {
        doc.addPage();
        y = 30;
      }
      
      doc.setFont('helvetica', 'bold');
      doc.text('Issued By:', leftCol, y);
      doc.text('Received By:', rightCol, y);
      y += 20;
      doc.line(leftCol, y, leftCol + 60, y);
      doc.line(rightCol, y, rightCol + 60, y);
      y += 5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text('Signature & Date', leftCol, y);
      doc.text('Signature & Date', rightCol, y);
      
      if (selectedSession.notes) {
        y += 15;
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('Notes:', leftCol, y);
        doc.setFont('helvetica', 'normal');
        const noteLines = doc.splitTextToSize(selectedSession.notes, pageWidth - 40);
        doc.text(noteLines, leftCol, y + 5);
      }
      
      doc.save(`Delivery_Note_${eventName.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast({ title: 'PDF downloaded successfully' });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: 'Failed to generate PDF', variant: 'destructive' });
    }
  };

  const handleDownloadDeliveryNoteExcel = async () => {
    if (!selectedSession) return;
    try {
      const XLSX = await import('xlsx');
      const eventName = getEventName(selectedSession.eventId);
      const data = sessionItemsForSelected.map((item, index) => {
        const invItem = getItemDetails(item.itemId);
        return {
          'SL No': index + 1,
          'Item Name': invItem?.name || 'Unknown',
          'Category': invItem?.category || '-',
          'Qty Issued': item.quantityIssued || 0,
          'Qty Returned': item.quantityReturned || 0,
          'Qty Damaged': item.quantityDamaged || 0,
          'Qty Lost': item.quantityLost || 0,
          'Status': item.quantityReturned === item.quantityIssued ? 'Returned' : 
                   (item.quantityDamaged || item.quantityLost) > 0 ? 'Damaged/Lost' : 'Issued',
          'Notes': item.damageNotes || '',
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Delivery Note');
      ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 25 }];
      XLSX.writeFile(wb, `Delivery_Note_${eventName.replace(/[^a-zA-Z0-9]/g, '_')}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast({ title: 'Excel file downloaded' });
    } catch (error) {
      toast({ title: 'Failed to download', variant: 'destructive' });
    }
  };

  const handleMarkReturned = (item: EventInventoryItem) => {
    updateSessionItemMutation.mutate({
      id: item.id,
      data: { quantityReturned: item.quantityIssued, quantityDamaged: 0, quantityLost: 0 }
    });
  };

  const handleMarkAllReturned = () => {
    sessionItemsForSelected.forEach(item => {
      if (item.quantityReturned !== item.quantityIssued) {
        updateSessionItemMutation.mutate({
          id: item.id,
          data: { quantityReturned: item.quantityIssued }
        });
      }
    });
  };

  const [cloneEventId, setCloneEventId] = useState('');
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Event Inventory</h1>
          <p className="text-muted-foreground">Track material outflow & inflow per event</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selectedSession && (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsDeliveryNoteOpen(true)} data-testid="button-print-delivery-note">
                <FileText className="w-4 h-4 mr-2" />
                Delivery Note
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsCloneModalOpen(true)} data-testid="button-clone-session">
                <Copy className="w-4 h-4 mr-2" />
                Clone
              </Button>
              <Button variant="outline" size="sm" onClick={handleMarkAllReturned} data-testid="button-mark-all-returned">
                <RotateCcw className="w-4 h-4 mr-2" />
                Mark All Returned
              </Button>
            </>
          )}
          <Button onClick={() => { setEditingSession(null); setFormData({ eventId: '', status: 'draft', notes: '' }); setIsModalOpen(true); }} data-testid="button-add-session">
            <Plus className="w-4 h-4 mr-2" />
            Create New
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sessions.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No sessions created yet</p>
              ) : (
                sessions.map(session => (
                  <div 
                    key={session.id} 
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedSession?.id === session.id ? 'border-amber-500 bg-amber-50' : 'hover:bg-muted/50'}`}
                    onClick={() => setSelectedSession(session)}
                    data-testid={`session-${session.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{getEventName(session.eventId)}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(session.status)}
                          {session.issuedAt && (
                            <span className="text-xs text-muted-foreground">
                              Issued: {format(new Date(session.issuedAt), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingSession(session); setFormData({ eventId: session.eventId, status: session.status, notes: session.notes || '' }); setIsModalOpen(true); }} data-testid={`button-edit-session-${session.id}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteSessionMutation.mutate(session.id); }} data-testid={`button-delete-session-${session.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {selectedSession ? `Items for ${getEventName(selectedSession.eventId)}` : 'Select a Session'}
              </CardTitle>
              {selectedSession && (
                <Button size="sm" onClick={() => { setItemFormData({ itemId: '', quantityIssued: '', quantityReturned: '', quantityDamaged: '', quantityLost: '', damageNotes: '' }); setIsItemModalOpen(true); }} data-testid="button-add-session-item">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedSession ? (
              <p className="text-center text-muted-foreground py-8">Select a session to view items</p>
            ) : sessionItemsForSelected.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No items in this session</p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8">SL</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Issued</TableHead>
                    <TableHead className="text-right">Returned</TableHead>
                    <TableHead className="text-right">Damaged</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionItemsForSelected.map((si, index) => {
                    const item = inventoryItems.find(i => i.id === si.itemId);
                    const isFullyReturned = si.quantityReturned === si.quantityIssued;
                    const hasDamage = (si.quantityDamaged || 0) > 0 || (si.quantityLost || 0) > 0;
                    return (
                      <TableRow key={si.id} className={isFullyReturned ? 'bg-green-50' : hasDamage ? 'bg-red-50' : ''}>
                        <TableCell className="font-medium">{index + 1}</TableCell>
                        <TableCell className="font-medium">{item?.name || 'Unknown'}</TableCell>
                        <TableCell className="text-muted-foreground">{item?.category || '-'}</TableCell>
                        <TableCell className="text-right font-semibold">{si.quantityIssued}</TableCell>
                        <TableCell className="text-right text-green-600">{si.quantityReturned || 0}</TableCell>
                        <TableCell className="text-right text-red-600">{(si.quantityDamaged || 0) + (si.quantityLost || 0)}</TableCell>
                        <TableCell>
                          {isFullyReturned ? (
                            <Badge className="bg-green-500"><Check className="w-3 h-3 mr-1" />Returned</Badge>
                          ) : hasDamage ? (
                            <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Damaged</Badge>
                          ) : (
                            <Badge variant="secondary">Issued</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {!isFullyReturned && (
                              <Button variant="ghost" size="icon" title="Mark as returned" onClick={() => handleMarkReturned(si)}>
                                <Check className="h-4 w-4 text-green-600" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" title="Edit" onClick={() => { 
                              setEditingItem(si);
                              setItemFormData({
                                itemId: si.itemId,
                                quantityIssued: String(si.quantityIssued || ''),
                                quantityReturned: String(si.quantityReturned || ''),
                                quantityDamaged: String(si.quantityDamaged || ''),
                                quantityLost: String(si.quantityLost || ''),
                                damageNotes: si.damageNotes || '',
                              });
                              setIsItemModalOpen(true);
                            }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" title="Delete" onClick={() => deleteSessionItemMutation.mutate(si.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSession ? 'Edit Session' : 'New Event Inventory Session'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Event *</Label>
              <Popover open={eventSearchOpen} onOpenChange={setEventSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={eventSearchOpen}
                    className="w-full justify-between"
                    data-testid="select-session-event"
                  >
                    {formData.eventId
                      ? events.find(e => e.id === formData.eventId)?.title || "Select event"
                      : "Select event"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search events..." 
                      value={eventSearchValue}
                      onValueChange={setEventSearchValue}
                    />
                    <CommandList>
                      <CommandEmpty>No events found.</CommandEmpty>
                      <CommandGroup>
                        {filteredEvents.map(event => (
                          <CommandItem
                            key={event.id}
                            value={event.title}
                            onSelect={() => {
                              setFormData({ ...formData, eventId: event.id });
                              setEventSearchOpen(false);
                              setEventSearchValue('');
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.eventId === event.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{event.title}</span>
                              <span className="text-xs text-muted-foreground">
                                {event.customer} - {event.date ? format(new Date(event.date), 'MMM d, yyyy') : 'No date'}
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
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger data-testid="select-session-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SESSION_STATUSES.map(s => (
                    <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} data-testid="input-session-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="button-submit-session">{editingSession ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isItemModalOpen} onOpenChange={(open) => { setIsItemModalOpen(open); if (!open) setEditingItem(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Session Item' : 'Add Item to Session'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            if (editingItem) {
              updateSessionItemMutation.mutate({
                id: editingItem.id,
                data: {
                  quantityIssued: parseInt(itemFormData.quantityIssued) || 0,
                  quantityReturned: parseInt(itemFormData.quantityReturned) || 0,
                  quantityDamaged: parseInt(itemFormData.quantityDamaged) || 0,
                  quantityLost: parseInt(itemFormData.quantityLost) || 0,
                  damageNotes: itemFormData.damageNotes,
                }
              });
              setIsItemModalOpen(false);
            } else {
              handleAddItem(e);
            }
          }} className="space-y-4">
            {!editingItem && (
              <div className="space-y-2">
                <Label>Item *</Label>
                <Popover open={itemSearchOpen} onOpenChange={setItemSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={itemSearchOpen}
                      className="w-full justify-between"
                      data-testid="select-session-item"
                    >
                      {itemFormData.itemId
                        ? inventoryItems.find(i => i.id === itemFormData.itemId)?.name || "Select inventory item"
                        : "Select inventory item"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search items..." 
                        value={itemSearchValue}
                        onValueChange={setItemSearchValue}
                      />
                      <CommandList>
                        <CommandEmpty>No items found.</CommandEmpty>
                        <CommandGroup>
                          {filteredInventoryItems.map(item => (
                            <CommandItem
                              key={item.id}
                              value={item.name}
                              onSelect={() => {
                                setItemFormData({ ...itemFormData, itemId: item.id });
                                setItemSearchOpen(false);
                                setItemSearchValue('');
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  itemFormData.itemId === item.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{item.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {item.category} - Stock: {item.stockQuantity}
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
            )}
            {editingItem && (
              <div className="p-3 bg-muted rounded">
                <p className="font-medium">{inventoryItems.find(i => i.id === editingItem.itemId)?.name || 'Unknown Item'}</p>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Qty Issued</Label>
                <Input type="number" value={itemFormData.quantityIssued} onChange={(e) => setItemFormData({ ...itemFormData, quantityIssued: e.target.value })} data-testid="input-qty-issued" />
              </div>
              <div className="space-y-2">
                <Label>Qty Returned</Label>
                <Input type="number" value={itemFormData.quantityReturned} onChange={(e) => setItemFormData({ ...itemFormData, quantityReturned: e.target.value })} data-testid="input-qty-returned" />
              </div>
              <div className="space-y-2">
                <Label>Qty Damaged</Label>
                <Input type="number" value={itemFormData.quantityDamaged} onChange={(e) => setItemFormData({ ...itemFormData, quantityDamaged: e.target.value })} data-testid="input-qty-damaged" />
              </div>
              <div className="space-y-2">
                <Label>Qty Lost / Missing</Label>
                <Input type="number" value={itemFormData.quantityLost} onChange={(e) => setItemFormData({ ...itemFormData, quantityLost: e.target.value })} data-testid="input-qty-lost" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Damage Notes</Label>
              <Textarea value={itemFormData.damageNotes} onChange={(e) => setItemFormData({ ...itemFormData, damageNotes: e.target.value })} placeholder="Describe any damage or issues" data-testid="input-damage-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsItemModalOpen(false); setEditingItem(null); }}>Cancel</Button>
              <Button type="submit" data-testid="button-submit-session-item">{editingItem ? 'Update Item' : 'Add Item'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCloneModalOpen} onOpenChange={setIsCloneModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clone Session to Another Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Select Target Event *</Label>
              <Popover open={cloneEventSearchOpen} onOpenChange={setCloneEventSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={cloneEventSearchOpen}
                    className="w-full justify-between"
                    data-testid="select-clone-event"
                  >
                    {cloneEventId
                      ? events.find(e => e.id === cloneEventId)?.title || "Select event to clone to"
                      : "Select event to clone to"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search events..." 
                      value={cloneEventSearchValue}
                      onValueChange={setCloneEventSearchValue}
                    />
                    <CommandList>
                      <CommandEmpty>No events found.</CommandEmpty>
                      <CommandGroup>
                        {filteredCloneEvents.map(event => (
                          <CommandItem
                            key={event.id}
                            value={event.title}
                            onSelect={() => {
                              setCloneEventId(event.id);
                              setCloneEventSearchOpen(false);
                              setCloneEventSearchValue('');
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                cloneEventId === event.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{event.title}</span>
                              <span className="text-xs text-muted-foreground">
                                {event.customer} - {event.date ? format(new Date(event.date), 'MMM d, yyyy') : 'No date'}
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
            <p className="text-sm text-muted-foreground">
              This will create a new session for the selected event with the same items. All return/damage tracking will be reset.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloneModalOpen(false)}>Cancel</Button>
            <Button onClick={() => {
              if (selectedSession && cloneEventId) {
                cloneSessionMutation.mutate({ sourceSessionId: selectedSession.id, newEventId: cloneEventId });
                setIsCloneModalOpen(false);
                setCloneEventId('');
              }
            }} disabled={!cloneEventId} data-testid="button-confirm-clone">
              Clone Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeliveryNoteOpen} onOpenChange={setIsDeliveryNoteOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delivery Note</DialogTitle>
            <DialogDescription>Generate a professional delivery note with company details</DialogDescription>
          </DialogHeader>
          {selectedSession && (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 p-4 bg-muted/30 rounded-lg">
                <div className="space-y-2">
                  <Label>Delivery Location *</Label>
                  <Textarea
                    placeholder="Enter delivery address..."
                    value={deliveryLocation}
                    onChange={(e) => setDeliveryLocation(e.target.value)}
                    rows={3}
                    data-testid="input-delivery-location"
                  />
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Contact Person</Label>
                    <Input
                      placeholder="Contact name"
                      value={contactPerson}
                      onChange={(e) => setContactPerson(e.target.value)}
                      data-testid="input-contact-person"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Phone</Label>
                    <Input
                      placeholder="Phone number"
                      value={contactPhone}
                      onChange={(e) => setContactPhone(e.target.value)}
                      data-testid="input-contact-phone"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 bg-white border rounded-lg" id="delivery-note-print">
                <div className="text-center border-b pb-4 mb-4">
                  <h1 className="text-2xl font-bold text-amber-700">{COMPANY_DEFAULTS.companyName}</h1>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{COMPANY_DEFAULTS.address}</p>
                  <p className="text-sm">Phone: {COMPANY_DEFAULTS.phone} | Email: {COMPANY_DEFAULTS.email}</p>
                  {COMPANY_DEFAULTS.gstNumber && <p className="text-sm">GSTIN: {COMPANY_DEFAULTS.gstNumber}</p>}
                </div>
                <div className="text-center mb-4">
                  <h2 className="text-xl font-bold border-b-2 border-amber-500 inline-block pb-1">DELIVERY NOTE</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 text-sm mb-4">
                  <div className="space-y-1">
                    <p><strong>Event:</strong> {getEventName(selectedSession.eventId)}</p>
                    <p><strong>Date:</strong> {selectedSession.issuedAt ? format(new Date(selectedSession.issuedAt), 'dd/MM/yyyy') : format(new Date(), 'dd/MM/yyyy')}</p>
                    {(() => {
                      const event = events.find(e => e.id === selectedSession.eventId);
                      return event?.venue ? <p><strong>Venue:</strong> {event.venue}</p> : null;
                    })()}
                    {deliveryLocation && (
                      <p><strong>Deliver To:</strong> {deliveryLocation}</p>
                    )}
                    {contactPerson && (
                      <p><strong>Contact:</strong> {contactPerson}{contactPhone ? ` - ${contactPhone}` : ''}</p>
                    )}
                  </div>
                  <div className="sm:text-right space-y-1">
                    <p><strong>Note #:</strong> DN-{selectedSession.id.slice(0, 8).toUpperCase()}</p>
                    <p><strong>Status:</strong> {selectedSession.status.replace('_', ' ').toUpperCase()}</p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-amber-50">
                      <TableHead className="font-bold w-12">SL</TableHead>
                      <TableHead className="font-bold">Item Description</TableHead>
                      <TableHead className="font-bold">Category</TableHead>
                      <TableHead className="text-right font-bold">Qty</TableHead>
                      <TableHead className="text-right font-bold">Returned</TableHead>
                      <TableHead className="font-bold">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionItemsForSelected.map((si, index) => {
                      const item = inventoryItems.find(i => i.id === si.itemId);
                      return (
                        <TableRow key={si.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell className="font-medium">{item?.name || 'Unknown'}</TableCell>
                          <TableCell>{item?.category || '-'}</TableCell>
                          <TableCell className="text-right">{si.quantityIssued}</TableCell>
                          <TableCell className="text-right">{si.quantityReturned || 0}</TableCell>
                          <TableCell>
                            <Badge variant={si.quantityReturned === si.quantityIssued ? 'default' : 'secondary'} className={si.quantityReturned === si.quantityIssued ? 'bg-green-500' : ''}>
                              {si.quantityReturned === si.quantityIssued ? 'Returned' : 
                               (si.quantityDamaged || si.quantityLost) ? 'Damaged' : 'Issued'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
                <div className="flex justify-between text-sm mt-4 pt-4 border-t">
                  <p><strong>Total Items:</strong> {sessionItemsForSelected.length}</p>
                  <p><strong>Total Quantity:</strong> {sessionItemsForSelected.reduce((sum, si) => sum + (si.quantityIssued || 0), 0)}</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 sm:gap-8 pt-8 mt-4 border-t">
                  <div>
                    <p className="font-bold mb-12">Issued By:</p>
                    <div className="border-t border-black pt-2 text-sm">Signature & Date</div>
                  </div>
                  <div>
                    <p className="font-bold mb-12">Received By:</p>
                    <div className="border-t border-black pt-2 text-sm">Signature & Date</div>
                  </div>
                </div>
                {selectedSession.notes && (
                  <div className="pt-4 mt-4 border-t">
                    <p className="font-bold">Notes:</p>
                    <p className="text-sm text-muted-foreground">{selectedSession.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setIsDeliveryNoteOpen(false)}>Close</Button>
            <Button variant="outline" onClick={handleDownloadDeliveryNoteExcel} data-testid="button-download-excel">
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button onClick={handleDownloadDeliveryNotePDF} data-testid="button-download-pdf">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RentalsSection({
  rentals,
  rentalItems,
  vendors,
  events,
}: {
  rentals: RentalRecord[];
  rentalItems: RentalItem[];
  vendors: Vendor[];
  events: Event[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingRental, setEditingRental] = useState<RentalRecord | null>(null);
  const [selectedRental, setSelectedRental] = useState<RentalRecord | null>(null);

  const [formData, setFormData] = useState({
    vendorId: '',
    eventId: '',
    rentalDate: format(new Date(), 'yyyy-MM-dd'),
    expectedReturnDate: '',
    status: 'active',
    totalCost: '',
    depositPaid: '',
    notes: '',
  });

  const [itemFormData, setItemFormData] = useState({
    itemName: '',
    quantity: '1',
    unitRate: '',
    condition: '',
    quantityReturned: '0',
    damageNotes: '',
  });

  const [editingItem, setEditingItem] = useState<RentalItem | null>(null);
  const [isCloneModalOpen, setIsCloneModalOpen] = useState(false);
  const [cloneEventId, setCloneEventId] = useState('');
  const [vendorSearchOpen, setVendorSearchOpen] = useState(false);
  const [vendorSearchValue, setVendorSearchValue] = useState('');
  const [eventSearchOpen, setEventSearchOpen] = useState(false);
  const [eventSearchValue, setEventSearchValue] = useState('');
  const [cloneEventSearchOpen, setCloneEventSearchOpen] = useState(false);
  const [cloneEventSearchValue, setCloneEventSearchValue] = useState('');

  const filteredVendors = useMemo(() => {
    if (!vendorSearchValue) return vendors;
    const search = vendorSearchValue.toLowerCase();
    return vendors.filter(v => v.name?.toLowerCase().includes(search));
  }, [vendors, vendorSearchValue]);

  const filteredEvents = useMemo(() => {
    if (!eventSearchValue) return events;
    const search = eventSearchValue.toLowerCase();
    return events.filter(e => 
      e.title?.toLowerCase().includes(search) || 
      e.customer?.toLowerCase().includes(search)
    );
  }, [events, eventSearchValue]);

  const filteredCloneEvents = useMemo(() => {
    const availableEvents = events.filter(e => e.id !== selectedRental?.eventId);
    if (!cloneEventSearchValue) return availableEvents;
    const search = cloneEventSearchValue.toLowerCase();
    return availableEvents.filter(e => 
      e.title?.toLowerCase().includes(search) || 
      e.customer?.toLowerCase().includes(search)
    );
  }, [events, selectedRental?.eventId, cloneEventSearchValue]);

  const createRentalMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/inventory/rentals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/rentals'] });
      setIsModalOpen(false);
      toast({ title: 'Rental created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create rental', description: error.message, variant: 'destructive' });
    },
  });

  const updateRentalMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest('PATCH', `/api/inventory/rentals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/rentals'] });
      setIsModalOpen(false);
      toast({ title: 'Rental updated successfully' });
    },
  });

  const deleteRentalMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/inventory/rentals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/rentals'] });
      toast({ title: 'Rental deleted' });
    },
  });

  const addRentalItemMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/inventory/rental-items', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/rental-items'] });
      setIsItemModalOpen(false);
      toast({ title: 'Rental item added' });
    },
  });

  const deleteRentalItemMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/inventory/rental-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/rental-items'] });
      toast({ title: 'Rental item removed' });
    },
  });

  const updateRentalItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest('PATCH', `/api/inventory/rental-items/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/rental-items'] });
      setEditingItem(null);
      toast({ title: 'Item updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update item', description: error.message, variant: 'destructive' });
    },
  });

  const cloneRentalMutation = useMutation({
    mutationFn: async ({ sourceRentalId, newEventId }: { sourceRentalId: string; newEventId: string }) => {
      const sourceRental = rentals.find(r => r.id === sourceRentalId);
      const sourceItems = rentalItems.filter(ri => ri.rentalId === sourceRentalId);
      const newRentalRes = await apiRequest('POST', '/api/inventory/rentals', {
        vendorId: sourceRental?.vendorId || null,
        eventId: newEventId,
        rentalDate: format(new Date(), 'yyyy-MM-dd'),
        expectedReturnDate: null,
        status: 'active',
        totalCost: sourceRental?.totalCost || '0',
        depositPaid: '0',
        notes: 'Cloned from another rental',
      });
      const newRental = newRentalRes as unknown as RentalRecord;
      for (const item of sourceItems) {
        await apiRequest('POST', '/api/inventory/rental-items', {
          rentalId: newRental.id,
          itemName: item.itemName,
          quantity: item.quantity,
          unitRate: item.unitRate,
          condition: item.condition,
          quantityReturned: 0,
          damageNotes: '',
        });
      }
      return newRental;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/rentals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/rental-items'] });
      setIsCloneModalOpen(false);
      setCloneEventId('');
      toast({ title: 'Rental cloned successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to clone rental', description: error.message, variant: 'destructive' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      vendorId: formData.vendorId || null,
      eventId: formData.eventId || null,
      expectedReturnDate: formData.expectedReturnDate || null,
    };
    if (editingRental) {
      updateRentalMutation.mutate({ id: editingRental.id, data });
    } else {
      createRentalMutation.mutate(data);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRental) return;
    addRentalItemMutation.mutate({
      rentalId: selectedRental.id,
      itemName: itemFormData.itemName,
      quantity: parseInt(itemFormData.quantity) || 1,
      unitRate: itemFormData.unitRate || '0',
      condition: itemFormData.condition || null,
    });
  };

  const getVendorName = (vendorId: string | null) => vendors.find(v => v.id === vendorId)?.name || 'N/A';
  const getEventName = (eventId: string | null) => events.find(e => e.id === eventId)?.title || 'N/A';
  const rentalItemsForSelected = selectedRental ? rentalItems.filter(ri => ri.rentalId === selectedRental.id) : [];

  const handleDownloadRentalItems = async () => {
    if (!selectedRental || rentalItemsForSelected.length === 0) return;
    
    const XLSX = await import('xlsx');
    const data = rentalItemsForSelected.map((item, index) => ({
      'SL No': index + 1,
      'Item Name': item.itemName,
      'Qty Issued': item.quantity,
      'Qty Returned': item.quantityReturned || 0,
      'Pending': item.quantity - (item.quantityReturned || 0),
      'Unit Rate': item.unitRate || '0',
      'Condition': item.condition || '',
      'Return Condition': item.returnCondition || '',
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rental Items');
    
    const vendorName = getVendorName(selectedRental.vendorId);
    const eventName = getEventName(selectedRental.eventId);
    XLSX.writeFile(wb, `Rental_${vendorName}_${eventName}_${format(new Date(), 'yyyyMMdd')}.xlsx`);
    toast({ title: 'Rental items downloaded successfully' });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active': return <Badge variant="default" className="bg-blue-500">Active</Badge>;
      case 'returned': return <Badge variant="default" className="bg-green-500">Returned</Badge>;
      case 'partial': return <Badge variant="default" className="bg-amber-500">Partial</Badge>;
      case 'overdue': return <Badge variant="destructive">Overdue</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Rentals</h1>
          <p className="text-muted-foreground">Track external equipment rentals</p>
        </div>
        <Button onClick={() => { setEditingRental(null); setFormData({ vendorId: '', eventId: '', rentalDate: format(new Date(), 'yyyy-MM-dd'), expectedReturnDate: '', status: 'active', totalCost: '', depositPaid: '', notes: '' }); setIsModalOpen(true); }} data-testid="button-add-rental">
          <Plus className="w-4 h-4 mr-2" />
          New Rental
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Rental Date</TableHead>
                <TableHead>Expected Return</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rentals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No rentals found</TableCell>
                </TableRow>
              ) : (
                rentals.map(rental => (
                  <TableRow key={rental.id} className={selectedRental?.id === rental.id ? 'bg-amber-50' : ''} onClick={() => setSelectedRental(rental)} data-testid={`row-rental-${rental.id}`}>
                    <TableCell>{getVendorName(rental.vendorId)}</TableCell>
                    <TableCell>{getEventName(rental.eventId)}</TableCell>
                    <TableCell>{format(new Date(rental.rentalDate), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{rental.expectedReturnDate ? format(new Date(rental.expectedReturnDate), 'MMM d, yyyy') : '-'}</TableCell>
                    <TableCell>{getStatusBadge(rental.status)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(rental.totalCost)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedRental(rental); setIsItemModalOpen(true); }} title="Add item" data-testid={`button-add-rental-item-${rental.id}`}>
                          <PackageOpen className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedRental(rental); setIsCloneModalOpen(true); }} title="Clone to another event" data-testid={`button-clone-rental-${rental.id}`}>
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingRental(rental); setFormData({ vendorId: rental.vendorId || '', eventId: rental.eventId || '', rentalDate: rental.rentalDate, expectedReturnDate: rental.expectedReturnDate || '', status: rental.status, totalCost: rental.totalCost || '', depositPaid: rental.depositPaid || '', notes: rental.notes || '' }); setIsModalOpen(true); }} data-testid={`button-edit-rental-${rental.id}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteRentalMutation.mutate(rental.id); }} data-testid={`button-delete-rental-${rental.id}`}>
                          <Trash2 className="h-4 w-4" />
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

      {selectedRental && rentalItemsForSelected.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Rental Items for {getVendorName(selectedRental.vendorId)}</CardTitle>
            <Button variant="outline" size="sm" onClick={() => handleDownloadRentalItems()} data-testid="button-download-rental-items">
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SL</TableHead>
                  <TableHead>Item Name</TableHead>
                  <TableHead className="text-right">Qty Issued</TableHead>
                  <TableHead className="text-right">Qty Returned</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Unit Rate</TableHead>
                  <TableHead>Condition</TableHead>
                  <TableHead>Return Condition</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rentalItemsForSelected.map((item, index) => (
                  <TableRow key={item.id} className={editingItem?.id === item.id ? 'bg-amber-50' : ''}>
                    <TableCell>{index + 1}</TableCell>
                    <TableCell>{item.itemName}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {editingItem?.id === item.id ? (
                        <Input
                          type="number"
                          className="w-20 text-right"
                          value={itemFormData.quantityReturned}
                          onChange={(e) => setItemFormData({ ...itemFormData, quantityReturned: e.target.value })}
                          min={0}
                          max={item.quantity}
                          data-testid={`input-returned-${item.id}`}
                        />
                      ) : (
                        item.quantityReturned || 0
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {item.quantity - (item.quantityReturned || 0) > 0 ? (
                        <Badge variant="destructive">{item.quantity - (item.quantityReturned || 0)}</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-700">0</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitRate)}</TableCell>
                    <TableCell>{item.condition || '-'}</TableCell>
                    <TableCell>
                      {editingItem?.id === item.id ? (
                        <Input
                          className="w-32"
                          value={itemFormData.damageNotes}
                          onChange={(e) => setItemFormData({ ...itemFormData, damageNotes: e.target.value })}
                          placeholder="Return condition"
                          data-testid={`input-return-condition-${item.id}`}
                        />
                      ) : (
                        item.returnCondition || '-'
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {editingItem?.id === item.id ? (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => {
                              updateRentalItemMutation.mutate({
                                id: item.id,
                                data: {
                                  quantityReturned: parseInt(itemFormData.quantityReturned) || 0,
                                  returnCondition: itemFormData.damageNotes,
                                },
                              });
                            }} data-testid={`button-save-rental-item-${item.id}`}>
                              <Check className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setEditingItem(null)} data-testid={`button-cancel-rental-item-${item.id}`}>
                              <X className="h-4 w-4 text-red-600" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" onClick={() => {
                              setEditingItem(item);
                              setItemFormData({
                                ...itemFormData,
                                quantityReturned: String(item.quantityReturned || 0),
                                damageNotes: item.returnCondition || '',
                              });
                            }} title="Edit return status" data-testid={`button-edit-rental-item-${item.id}`}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => deleteRentalItemMutation.mutate(item.id)} data-testid={`button-delete-rental-item-${item.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRental ? 'Edit Rental' : 'New Rental Record'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Popover open={vendorSearchOpen} onOpenChange={setVendorSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={vendorSearchOpen}
                      className="w-full justify-between"
                      data-testid="select-rental-vendor"
                    >
                      {formData.vendorId
                        ? vendors.find(v => v.id === formData.vendorId)?.name || "Select vendor"
                        : "Select vendor"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search vendors..." 
                        value={vendorSearchValue}
                        onValueChange={setVendorSearchValue}
                      />
                      <CommandList>
                        <CommandEmpty>No vendors found.</CommandEmpty>
                        <CommandGroup>
                          {filteredVendors.map(v => (
                            <CommandItem
                              key={v.id}
                              value={v.name}
                              onSelect={() => {
                                setFormData({ ...formData, vendorId: v.id });
                                setVendorSearchOpen(false);
                                setVendorSearchValue('');
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", formData.vendorId === v.id ? "opacity-100" : "opacity-0")} />
                              {v.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Event</Label>
                <Popover open={eventSearchOpen} onOpenChange={setEventSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={eventSearchOpen}
                      className="w-full justify-between"
                      data-testid="select-rental-event"
                    >
                      {formData.eventId
                        ? events.find(e => e.id === formData.eventId)?.title || "Select event"
                        : "Select event"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search events..." 
                        value={eventSearchValue}
                        onValueChange={setEventSearchValue}
                      />
                      <CommandList>
                        <CommandEmpty>No events found.</CommandEmpty>
                        <CommandGroup>
                          {filteredEvents.map(event => (
                            <CommandItem
                              key={event.id}
                              value={event.title}
                              onSelect={() => {
                                setFormData({ ...formData, eventId: event.id });
                                setEventSearchOpen(false);
                                setEventSearchValue('');
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", formData.eventId === event.id ? "opacity-100" : "opacity-0")} />
                              <div className="flex flex-col">
                                <span>{event.title}</span>
                                <span className="text-xs text-muted-foreground">
                                  {event.customer} - {event.date ? format(new Date(event.date), 'MMM d, yyyy') : 'No date'}
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
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Rental Date *</Label>
                <Input type="date" value={formData.rentalDate} onChange={(e) => setFormData({ ...formData, rentalDate: e.target.value })} required data-testid="input-rental-date" />
              </div>
              <div className="space-y-2">
                <Label>Expected Return</Label>
                <Input type="date" value={formData.expectedReturnDate} onChange={(e) => setFormData({ ...formData, expectedReturnDate: e.target.value })} data-testid="input-return-date" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger data-testid="select-rental-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RENTAL_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Total Cost</Label>
                <Input type="number" step="0.01" value={formData.totalCost} onChange={(e) => setFormData({ ...formData, totalCost: e.target.value })} data-testid="input-rental-cost" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Deposit Paid</Label>
              <Input type="number" step="0.01" value={formData.depositPaid} onChange={(e) => setFormData({ ...formData, depositPaid: e.target.value })} data-testid="input-rental-deposit" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} data-testid="input-rental-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="button-submit-rental">{editingRental ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Rental Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-4">
            <div className="space-y-2">
              <Label>Item Name *</Label>
              <Input value={itemFormData.itemName} onChange={(e) => setItemFormData({ ...itemFormData, itemName: e.target.value })} required data-testid="input-rental-item-name" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" value={itemFormData.quantity} onChange={(e) => setItemFormData({ ...itemFormData, quantity: e.target.value })} data-testid="input-rental-item-qty" />
              </div>
              <div className="space-y-2">
                <Label>Unit Rate</Label>
                <Input type="number" step="0.01" value={itemFormData.unitRate} onChange={(e) => setItemFormData({ ...itemFormData, unitRate: e.target.value })} data-testid="input-rental-item-rate" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Condition Notes</Label>
              <Textarea value={itemFormData.condition} onChange={(e) => setItemFormData({ ...itemFormData, condition: e.target.value })} data-testid="input-rental-item-condition" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsItemModalOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="button-submit-rental-item">Add Item</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCloneModalOpen} onOpenChange={setIsCloneModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clone Rental to Another Event</DialogTitle>
            <DialogDescription>
              This will copy all items from the selected rental to a new rental for a different event.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Target Event *</Label>
              <Popover open={cloneEventSearchOpen} onOpenChange={setCloneEventSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={cloneEventSearchOpen}
                    className="w-full justify-between"
                    data-testid="select-clone-rental-event"
                  >
                    {cloneEventId
                      ? events.find(e => e.id === cloneEventId)?.title || "Select event to clone to"
                      : "Select event to clone to"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search events..." 
                      value={cloneEventSearchValue}
                      onValueChange={setCloneEventSearchValue}
                    />
                    <CommandList>
                      <CommandEmpty>No events found.</CommandEmpty>
                      <CommandGroup>
                        {filteredCloneEvents.map(event => (
                          <CommandItem
                            key={event.id}
                            value={event.title}
                            onSelect={() => {
                              setCloneEventId(event.id);
                              setCloneEventSearchOpen(false);
                              setCloneEventSearchValue('');
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", cloneEventId === event.id ? "opacity-100" : "opacity-0")} />
                            <div className="flex flex-col">
                              <span>{event.title}</span>
                              <span className="text-xs text-muted-foreground">
                                {event.customer} - {event.date ? format(new Date(event.date), 'MMM d, yyyy') : 'No date'}
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
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsCloneModalOpen(false); setCloneEventId(''); setCloneEventSearchValue(''); }}>Cancel</Button>
              <Button
                disabled={!cloneEventId || !selectedRental || cloneRentalMutation.isPending}
                onClick={() => {
                  if (selectedRental && cloneEventId) {
                    cloneRentalMutation.mutate({ sourceRentalId: selectedRental.id, newEventId: cloneEventId });
                  }
                }}
                data-testid="button-confirm-clone-rental"
              >
                {cloneRentalMutation.isPending ? 'Cloning...' : 'Clone Rental'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TemplatesSection({
  templates,
  templateItems,
  inventoryItems,
}: {
  templates: InventoryTemplate[];
  templateItems: InventoryTemplateItem[];
  inventoryItems: InventoryItem[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InventoryTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<InventoryTemplate | null>(null);

  const [formData, setFormData] = useState({ name: '', eventType: 'Wedding Stage Décor', description: '', isActive: true });
  const [itemFormData, setItemFormData] = useState({ itemId: '', itemName: '', quantity: '1', notes: '' });

  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/inventory/templates', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/templates'] });
      setIsModalOpen(false);
      toast({ title: 'Template created successfully' });
    },
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest('PATCH', `/api/inventory/templates/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/templates'] });
      setIsModalOpen(false);
      toast({ title: 'Template updated successfully' });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/inventory/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/templates'] });
      toast({ title: 'Template deleted' });
    },
  });

  const addTemplateItemMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/inventory/template-items', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/template-items'] });
      setIsItemModalOpen(false);
      toast({ title: 'Item added to template' });
    },
  });

  const deleteTemplateItemMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/inventory/template-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/template-items'] });
      toast({ title: 'Item removed from template' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data: formData });
    } else {
      createTemplateMutation.mutate(formData);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplate) return;
    const selectedItem = inventoryItems.find(i => i.id === itemFormData.itemId);
    addTemplateItemMutation.mutate({
      templateId: selectedTemplate.id,
      itemId: itemFormData.itemId || null,
      itemName: selectedItem?.name || itemFormData.itemName,
      quantity: parseInt(itemFormData.quantity) || 1,
      notes: itemFormData.notes || null,
    });
  };

  const templateItemsForSelected = selectedTemplate ? templateItems.filter(ti => ti.templateId === selectedTemplate.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Templates</h1>
          <p className="text-muted-foreground">Pre-configured item bundles for events</p>
        </div>
        <Button onClick={() => { setEditingTemplate(null); setFormData({ name: '', eventType: 'Wedding Stage Décor', description: '', isActive: true }); setIsModalOpen(true); }} data-testid="button-add-template">
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Template List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {templates.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No templates created yet</p>
              ) : (
                templates.map(template => {
                  const itemCount = templateItems.filter(ti => ti.templateId === template.id).length;
                  return (
                    <div 
                      key={template.id} 
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedTemplate?.id === template.id ? 'border-amber-500 bg-amber-50' : 'hover:bg-muted/50'}`}
                      onClick={() => setSelectedTemplate(template)}
                      data-testid={`template-${template.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{template.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{template.eventType}</Badge>
                            <span className="text-xs text-muted-foreground">{itemCount} items</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingTemplate(template); setFormData({ name: template.name, eventType: template.eventType, description: template.description || '', isActive: template.isActive }); setIsModalOpen(true); }} data-testid={`button-edit-template-${template.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deleteTemplateMutation.mutate(template.id); }} data-testid={`button-delete-template-${template.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{selectedTemplate ? `Items in ${selectedTemplate.name}` : 'Select a Template'}</CardTitle>
              {selectedTemplate && (
                <Button size="sm" onClick={() => { setItemFormData({ itemId: '', itemName: '', quantity: '1', notes: '' }); setIsItemModalOpen(true); }} data-testid="button-add-template-item">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Item
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedTemplate ? (
              <p className="text-center text-muted-foreground py-8">Select a template to view items</p>
            ) : templateItemsForSelected.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No items in this template</p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templateItemsForSelected.map(ti => (
                    <TableRow key={ti.id}>
                      <TableCell>{ti.itemName}</TableCell>
                      <TableCell className="text-right">{ti.quantity}</TableCell>
                      <TableCell className="text-muted-foreground">{ti.notes || '-'}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteTemplateItemMutation.mutate(ti.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? 'Edit Template' : 'New Template'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required data-testid="input-template-name" />
            </div>
            <div className="space-y-2">
              <Label>Event Type *</Label>
              <Select value={formData.eventType} onValueChange={(v) => setFormData({ ...formData, eventType: v })}>
                <SelectTrigger data-testid="select-template-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} data-testid="input-template-desc" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="templateActive" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="rounded" data-testid="checkbox-template-active" />
              <Label htmlFor="templateActive">Template is active</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="button-submit-template">{editingTemplate ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Item to Template</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-4">
            <div className="space-y-2">
              <Label>Select from Inventory</Label>
              <Select value={itemFormData.itemId} onValueChange={(v) => setItemFormData({ ...itemFormData, itemId: v })}>
                <SelectTrigger data-testid="select-template-item">
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {inventoryItems.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Or enter item name</Label>
              <Input value={itemFormData.itemName} onChange={(e) => setItemFormData({ ...itemFormData, itemName: e.target.value })} placeholder="Custom item name" data-testid="input-template-item-name" />
            </div>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" value={itemFormData.quantity} onChange={(e) => setItemFormData({ ...itemFormData, quantity: e.target.value })} data-testid="input-template-item-qty" />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={itemFormData.notes} onChange={(e) => setItemFormData({ ...itemFormData, notes: e.target.value })} data-testid="input-template-item-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsItemModalOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="button-submit-template-item">Add Item</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PurchaseOrdersSection({
  purchaseOrders,
  poItems,
  vendors,
  events,
  inventoryItems,
}: {
  purchaseOrders: PurchaseOrder[];
  poItems: PurchaseOrderItem[];
  vendors: Vendor[];
  events: Event[];
  inventoryItems: InventoryItem[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

  const [formData, setFormData] = useState({
    poNumber: '',
    vendorId: '',
    eventId: '',
    orderDate: format(new Date(), 'yyyy-MM-dd'),
    expectedDelivery: '',
    status: 'draft',
    notes: '',
  });

  const [itemFormData, setItemFormData] = useState({ itemId: '', itemName: '', quantity: '1', unitPrice: '' });

  const createPOMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/inventory/purchase-orders', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/purchase-orders'] });
      setIsModalOpen(false);
      toast({ title: 'Purchase order created' });
    },
  });

  const updatePOMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest('PATCH', `/api/inventory/purchase-orders/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/purchase-orders'] });
      setIsModalOpen(false);
      toast({ title: 'Purchase order updated' });
    },
  });

  const deletePOMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/inventory/purchase-orders/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/purchase-orders'] });
      toast({ title: 'Purchase order deleted' });
    },
  });

  const addPOItemMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/inventory/po-items', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/po-items'] });
      setIsItemModalOpen(false);
      toast({ title: 'Item added to PO' });
    },
  });

  const deletePOItemMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/inventory/po-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/po-items'] });
      toast({ title: 'Item removed from PO' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...formData,
      vendorId: formData.vendorId || null,
      eventId: formData.eventId || null,
      expectedDelivery: formData.expectedDelivery || null,
    };
    if (editingPO) {
      updatePOMutation.mutate({ id: editingPO.id, data });
    } else {
      createPOMutation.mutate(data);
    }
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPO) return;
    const qty = parseInt(itemFormData.quantity) || 1;
    const price = parseFloat(itemFormData.unitPrice) || 0;
    const selectedItem = inventoryItems.find(i => i.id === itemFormData.itemId);
    addPOItemMutation.mutate({
      poId: selectedPO.id,
      itemId: itemFormData.itemId || null,
      itemName: selectedItem?.name || itemFormData.itemName,
      quantity: qty,
      unitPrice: itemFormData.unitPrice || '0',
      totalPrice: String(qty * price),
    });
  };

  const getVendorName = (vendorId: string | null) => vendors.find(v => v.id === vendorId)?.name || 'N/A';
  const getEventName = (eventId: string | null) => events.find(e => e.id === eventId)?.title || 'N/A';

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = { draft: 'bg-gray-500', sent: 'bg-blue-500', confirmed: 'bg-amber-500', received: 'bg-green-500', cancelled: 'bg-red-500' };
    return <Badge variant="default" className={colors[status] || 'bg-gray-500'}>{status}</Badge>;
  };

  const poItemsForSelected = selectedPO ? poItems.filter(pi => pi.poId === selectedPO.id) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Purchase Orders</h1>
          <p className="text-muted-foreground">Manage vendor purchase orders</p>
        </div>
        <Button onClick={() => { setEditingPO(null); setFormData({ poNumber: `PO-${Date.now()}`, vendorId: '', eventId: '', orderDate: format(new Date(), 'yyyy-MM-dd'), expectedDelivery: '', status: 'draft', notes: '' }); setIsModalOpen(true); }} data-testid="button-add-po">
          <Plus className="w-4 h-4 mr-2" />
          New PO
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO #</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Order Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total Amount</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No purchase orders found</TableCell>
                </TableRow>
              ) : (
                purchaseOrders.map(po => (
                  <TableRow key={po.id} className={selectedPO?.id === po.id ? 'bg-amber-50' : ''} onClick={() => setSelectedPO(po)} data-testid={`row-po-${po.id}`}>
                    <TableCell className="font-mono">{po.poNumber}</TableCell>
                    <TableCell>{getVendorName(po.vendorId)}</TableCell>
                    <TableCell>{getEventName(po.eventId)}</TableCell>
                    <TableCell>{format(new Date(po.orderDate), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{getStatusBadge(po.status)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(po.totalAmount)}</TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedPO(po); setIsItemModalOpen(true); }} data-testid={`button-add-po-item-${po.id}`}>
                          <PackageOpen className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingPO(po); setFormData({ poNumber: po.poNumber, vendorId: po.vendorId || '', eventId: po.eventId || '', orderDate: po.orderDate, expectedDelivery: po.expectedDelivery || '', status: po.status, notes: po.notes || '' }); setIsModalOpen(true); }} data-testid={`button-edit-po-${po.id}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deletePOMutation.mutate(po.id); }} data-testid={`button-delete-po-${po.id}`}>
                          <Trash2 className="h-4 w-4" />
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

      {selectedPO && poItemsForSelected.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Items in {selectedPO.poNumber}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {poItemsForSelected.map(item => (
                  <TableRow key={item.id}>
                    <TableCell>{item.itemName}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.totalPrice)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => deletePOItemMutation.mutate(item.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPO ? 'Edit Purchase Order' : 'New Purchase Order'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>PO Number *</Label>
              <Input value={formData.poNumber} onChange={(e) => setFormData({ ...formData, poNumber: e.target.value })} required data-testid="input-po-number" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Select value={formData.vendorId} onValueChange={(v) => setFormData({ ...formData, vendorId: v })}>
                  <SelectTrigger data-testid="select-po-vendor">
                    <SelectValue placeholder="Select vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Event</Label>
                <Select value={formData.eventId} onValueChange={(v) => setFormData({ ...formData, eventId: v })}>
                  <SelectTrigger data-testid="select-po-event">
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map(e => <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Order Date *</Label>
                <Input type="date" value={formData.orderDate} onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })} required data-testid="input-po-date" />
              </div>
              <div className="space-y-2">
                <Label>Expected Delivery</Label>
                <Input type="date" value={formData.expectedDelivery} onChange={(e) => setFormData({ ...formData, expectedDelivery: e.target.value })} data-testid="input-po-delivery" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger data-testid="select-po-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PO_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} data-testid="input-po-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="button-submit-po">{editingPO ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isItemModalOpen} onOpenChange={setIsItemModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Item to PO</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddItem} className="space-y-4">
            <div className="space-y-2">
              <Label>Select from Inventory</Label>
              <Select value={itemFormData.itemId} onValueChange={(v) => setItemFormData({ ...itemFormData, itemId: v })}>
                <SelectTrigger data-testid="select-po-item">
                  <SelectValue placeholder="Select item" />
                </SelectTrigger>
                <SelectContent>
                  {inventoryItems.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Or enter item name</Label>
              <Input value={itemFormData.itemName} onChange={(e) => setItemFormData({ ...itemFormData, itemName: e.target.value })} placeholder="Custom item name" data-testid="input-po-item-name" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input type="number" value={itemFormData.quantity} onChange={(e) => setItemFormData({ ...itemFormData, quantity: e.target.value })} data-testid="input-po-item-qty" />
              </div>
              <div className="space-y-2">
                <Label>Unit Price</Label>
                <Input type="number" step="0.01" value={itemFormData.unitPrice} onChange={(e) => setItemFormData({ ...itemFormData, unitPrice: e.target.value })} data-testid="input-po-item-price" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsItemModalOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="button-submit-po-item">Add Item</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductionPlansSection({
  plans,
  tasks,
  events,
  vendors,
  users,
}: {
  plans: ProductionPlan[];
  tasks: ProductionTask[];
  events: Event[];
  vendors: Vendor[];
  users: User[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ProductionPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ProductionPlan | null>(null);

  const [formData, setFormData] = useState({ name: '', eventId: '', status: 'draft' });
  const [taskFormData, setTaskFormData] = useState({ activity: '', startTime: '', endTime: '', vendorId: '', responsiblePersonId: '', responsiblePersonName: '', status: 'pending', notes: '' });
  const [eventSearchOpen, setEventSearchOpen] = useState(false);
  const [eventSearchValue, setEventSearchValue] = useState('');
  const [vendorSearchOpen, setVendorSearchOpen] = useState(false);
  const [vendorSearchValue, setVendorSearchValue] = useState('');
  const [userSearchOpen, setUserSearchOpen] = useState(false);
  const [userSearchValue, setUserSearchValue] = useState('');

  const filteredEvents = useMemo(() => {
    if (!eventSearchValue) return events;
    const search = eventSearchValue.toLowerCase();
    return events.filter(e => 
      e.title?.toLowerCase().includes(search) || 
      e.customer?.toLowerCase().includes(search)
    );
  }, [events, eventSearchValue]);

  const filteredVendors = useMemo(() => {
    if (!vendorSearchValue) return vendors;
    const search = vendorSearchValue.toLowerCase();
    return vendors.filter(v => v.name?.toLowerCase().includes(search));
  }, [vendors, vendorSearchValue]);

  const filteredUsers = useMemo(() => {
    if (!userSearchValue) return users;
    const search = userSearchValue.toLowerCase();
    return users.filter(u => u.name?.toLowerCase().includes(search));
  }, [users, userSearchValue]);

  const createPlanMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/inventory/production-plans', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production-plans'] });
      setIsModalOpen(false);
      toast({ title: 'Production plan created' });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest('PATCH', `/api/inventory/production-plans/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production-plans'] });
      setIsModalOpen(false);
      toast({ title: 'Production plan updated' });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/inventory/production-plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production-plans'] });
      toast({ title: 'Production plan deleted' });
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/inventory/production-tasks', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production-tasks'] });
      setIsTaskModalOpen(false);
      toast({ title: 'Task added to plan' });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest('PATCH', `/api/inventory/production-tasks/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production-tasks'] });
      toast({ title: 'Task updated' });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/inventory/production-tasks/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production-tasks'] });
      toast({ title: 'Task deleted' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...formData, eventId: formData.eventId || null };
    if (editingPlan) {
      updatePlanMutation.mutate({ id: editingPlan.id, data });
    } else {
      createPlanMutation.mutate(data);
    }
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;
    const selectedUser = users.find(u => u.id === taskFormData.responsiblePersonId);
    addTaskMutation.mutate({
      planId: selectedPlan.id,
      activity: taskFormData.activity,
      startTime: taskFormData.startTime || null,
      endTime: taskFormData.endTime || null,
      vendorId: taskFormData.vendorId || null,
      responsiblePersonId: taskFormData.responsiblePersonId || null,
      responsiblePersonName: selectedUser?.name || taskFormData.responsiblePersonName || null,
      status: taskFormData.status,
      notes: taskFormData.notes || null,
    });
  };

  const getEventName = (eventId: string | null) => events.find(e => e.id === eventId)?.title || 'N/A';
  const getVendorName = (vendorId: string | null) => vendors.find(v => v.id === vendorId)?.name || '-';

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = { draft: 'bg-gray-500', active: 'bg-blue-500', completed: 'bg-green-500', pending: 'bg-gray-500', in_progress: 'bg-amber-500' };
    return <Badge variant="default" className={colors[status] || 'bg-gray-500'}>{status.replace('_', ' ')}</Badge>;
  };

  const tasksForSelected = selectedPlan ? tasks.filter(t => t.planId === selectedPlan.id).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Production Plans</h1>
          <p className="text-muted-foreground">Event execution schedules and tasks</p>
        </div>
        <Button onClick={() => { setEditingPlan(null); setFormData({ name: '', eventId: '', status: 'draft' }); setIsModalOpen(true); }} data-testid="button-add-plan">
          <Plus className="w-4 h-4 mr-2" />
          New Plan
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Plans</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {plans.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No plans created yet</p>
              ) : (
                plans.map(plan => {
                  const taskCount = tasks.filter(t => t.planId === plan.id).length;
                  return (
                    <div 
                      key={plan.id} 
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedPlan?.id === plan.id ? 'border-amber-500 bg-amber-50' : 'hover:bg-muted/50'}`}
                      onClick={() => setSelectedPlan(plan)}
                      data-testid={`plan-${plan.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{plan.name}</p>
                          <p className="text-sm text-muted-foreground">{getEventName(plan.eventId)}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {getStatusBadge(plan.status)}
                            <span className="text-xs text-muted-foreground">{taskCount} tasks</span>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setEditingPlan(plan); setFormData({ name: plan.name, eventId: plan.eventId || '', status: plan.status }); setIsModalOpen(true); }} data-testid={`button-edit-plan-${plan.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); deletePlanMutation.mutate(plan.id); }} data-testid={`button-delete-plan-${plan.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{selectedPlan ? `Tasks for ${selectedPlan.name}` : 'Select a Plan'}</CardTitle>
              {selectedPlan && (
                <Button size="sm" onClick={() => { setTaskFormData({ activity: '', startTime: '', endTime: '', vendorId: '', responsiblePersonId: '', responsiblePersonName: '', status: 'pending', notes: '' }); setIsTaskModalOpen(true); }} data-testid="button-add-task">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Task
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!selectedPlan ? (
              <p className="text-center text-muted-foreground py-8">Select a plan to view tasks</p>
            ) : tasksForSelected.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No tasks in this plan</p>
            ) : (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Activity</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Responsible</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasksForSelected.map(task => (
                    <TableRow key={task.id} data-testid={`task-${task.id}`}>
                      <TableCell className="font-medium">{task.activity}</TableCell>
                      <TableCell className="text-sm">
                        {task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : task.startTime || task.endTime || '-'}
                      </TableCell>
                      <TableCell>{getVendorName(task.vendorId)}</TableCell>
                      <TableCell>{task.responsiblePersonName || '-'}</TableCell>
                      <TableCell>
                        <Select
                          value={task.status}
                          onValueChange={(v) => updateTaskMutation.mutate({ id: task.id, data: { status: v } })}
                        >
                          <SelectTrigger className="w-[120px] h-8" data-testid={`select-task-status-${task.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => deleteTaskMutation.mutate(task.id)} data-testid={`button-delete-task-${task.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Production Plan' : 'New Production Plan'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Plan Name *</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required data-testid="input-plan-name" />
            </div>
            <div className="space-y-2">
              <Label>Event</Label>
              <Popover open={eventSearchOpen} onOpenChange={setEventSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={eventSearchOpen}
                    className="w-full justify-between"
                    data-testid="select-plan-event"
                  >
                    {formData.eventId
                      ? events.find(e => e.id === formData.eventId)?.title || "Select event"
                      : "Select event"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput 
                      placeholder="Search events..." 
                      value={eventSearchValue}
                      onValueChange={setEventSearchValue}
                    />
                    <CommandList>
                      <CommandEmpty>No events found.</CommandEmpty>
                      <CommandGroup>
                        {filteredEvents.map(event => (
                          <CommandItem
                            key={event.id}
                            value={event.title}
                            onSelect={() => {
                              setFormData({ ...formData, eventId: event.id });
                              setEventSearchOpen(false);
                              setEventSearchValue('');
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                formData.eventId === event.id ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div className="flex flex-col">
                              <span>{event.title}</span>
                              <span className="text-xs text-muted-foreground">
                                {event.customer} - {event.date ? format(new Date(event.date), 'MMM d, yyyy') : 'No date'}
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
              <Label>Status</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                <SelectTrigger data-testid="select-plan-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="button-submit-plan">{editingPlan ? 'Update' : 'Create'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isTaskModalOpen} onOpenChange={setIsTaskModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Task to Plan</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTask} className="space-y-4">
            <div className="space-y-2">
              <Label>Activity *</Label>
              <Input value={taskFormData.activity} onChange={(e) => setTaskFormData({ ...taskFormData, activity: e.target.value })} required data-testid="input-task-activity" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={taskFormData.startTime} onChange={(e) => setTaskFormData({ ...taskFormData, startTime: e.target.value })} data-testid="input-task-start" />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={taskFormData.endTime} onChange={(e) => setTaskFormData({ ...taskFormData, endTime: e.target.value })} data-testid="input-task-end" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Vendor</Label>
                <Popover open={vendorSearchOpen} onOpenChange={setVendorSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={vendorSearchOpen}
                      className="w-full justify-between"
                      data-testid="select-task-vendor"
                    >
                      {taskFormData.vendorId
                        ? vendors.find(v => v.id === taskFormData.vendorId)?.name || "Select vendor"
                        : "Select vendor"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search vendors..." 
                        value={vendorSearchValue}
                        onValueChange={setVendorSearchValue}
                      />
                      <CommandList>
                        <CommandEmpty>No vendors found.</CommandEmpty>
                        <CommandGroup>
                          {filteredVendors.map(v => (
                            <CommandItem
                              key={v.id}
                              value={v.name}
                              onSelect={() => {
                                setTaskFormData({ ...taskFormData, vendorId: v.id });
                                setVendorSearchOpen(false);
                                setVendorSearchValue('');
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", taskFormData.vendorId === v.id ? "opacity-100" : "opacity-0")} />
                              {v.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Responsible Person</Label>
                <Popover open={userSearchOpen} onOpenChange={setUserSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={userSearchOpen}
                      className="w-full justify-between"
                      data-testid="select-task-person"
                    >
                      {taskFormData.responsiblePersonId
                        ? users.find(u => u.id === taskFormData.responsiblePersonId)?.name || "Select person"
                        : "Select person"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0" align="start">
                    <Command>
                      <CommandInput 
                        placeholder="Search people..." 
                        value={userSearchValue}
                        onValueChange={setUserSearchValue}
                      />
                      <CommandList>
                        <CommandEmpty>No people found.</CommandEmpty>
                        <CommandGroup>
                          {filteredUsers.map(u => (
                            <CommandItem
                              key={u.id}
                              value={u.name}
                              onSelect={() => {
                                setTaskFormData({ ...taskFormData, responsiblePersonId: u.id });
                                setUserSearchOpen(false);
                                setUserSearchValue('');
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", taskFormData.responsiblePersonId === u.id ? "opacity-100" : "opacity-0")} />
                              {u.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Or enter person name</Label>
              <Input value={taskFormData.responsiblePersonName} onChange={(e) => setTaskFormData({ ...taskFormData, responsiblePersonName: e.target.value })} placeholder="Person name" data-testid="input-task-person-name" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={taskFormData.status} onValueChange={(v) => setTaskFormData({ ...taskFormData, status: v })}>
                <SelectTrigger data-testid="select-task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={taskFormData.notes} onChange={(e) => setTaskFormData({ ...taskFormData, notes: e.target.value })} data-testid="input-task-notes" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsTaskModalOpen(false)}>Cancel</Button>
              <Button type="submit" data-testid="button-submit-task">Add Task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

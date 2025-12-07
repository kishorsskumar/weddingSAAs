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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ChevronsUpDown,
  Upload,
  Image as ImageIcon,
  Loader2
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
  ProductionDecorItem,
  ProductionDecorElement,
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

type Section = 'items' | 'event-inventory' | 'rentals' | 'templates' | 'purchase-orders' | 'production-plans' | 'decor-planning';

const DEFAULT_CATEGORIES = ["Décor", "Furniture", "Lighting", "Linens", "Props", "Florals", "Electronics", "Other"];
const EVENT_TYPES = ["Wedding Stage Décor", "Reception Setup", "Corporate Event", "Birthday Party", "Other"];
const SESSION_STATUSES = ["draft", "issued", "partial_return", "completed"];
const RENTAL_STATUSES = ["active", "returned", "partial", "overdue"];
const PO_STATUSES = ["draft", "sent", "confirmed", "received", "cancelled"];
const PLAN_STATUSES = ["draft", "active", "completed"];
const TASK_STATUSES = ["pending", "in_progress", "completed"];

const formatCurrency = (amount: string | number | null | undefined) => {
  if (amount === null || amount === undefined || amount === '') return '₹0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
};

const safeNumber = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined || value === '') return 0;
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(num) ? 0 : num;
};

const sidebarItems = [
  { id: 'items', label: 'Inventory Items', icon: Package },
  { id: 'event-inventory', label: 'Event Inventory', icon: Boxes },
  { id: 'rentals', label: 'Rentals', icon: Truck },
  { id: 'templates', label: 'Templates', icon: FileText },
  { id: 'purchase-orders', label: 'Purchase Orders', icon: ClipboardList },
  { id: 'production-plans', label: 'Execution Plans', icon: Factory },
  { id: 'decor-planning', label: 'Production Planning', icon: ClipboardList },
];

function ImageUpload({ 
  photos, 
  onPhotosChange, 
  maxFiles = 5 
}: { 
  photos: string[]; 
  onPhotosChange: (photos: string[]) => void; 
  maxFiles?: number;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (photos.length + files.length > maxFiles) {
      toast({ 
        title: `Maximum ${maxFiles} images allowed`, 
        variant: 'destructive' 
      });
      return;
    }

    setIsUploading(true);
    const newPhotos: string[] = [];

    for (const file of Array.from(files)) {
      try {
        const reader = new FileReader();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        newPhotos.push(dataUrl);
      } catch (error) {
        console.error('Upload error:', error);
        toast({ title: 'Failed to process image', variant: 'destructive' });
      }
    }

    setIsUploading(false);
    onPhotosChange([...photos, ...newPhotos]);
    e.target.value = '';
  };

  const removePhoto = (index: number) => {
    const newPhotos = [...photos];
    newPhotos.splice(index, 1);
    onPhotosChange(newPhotos);
  };

  return (
    <div className="space-y-3">
      <Label>Item Photos</Label>
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, index) => (
          <div key={index} className="relative group">
            <img
              src={photo}
              alt={`Item photo ${index + 1}`}
              className="w-20 h-20 object-cover rounded-lg border"
            />
            <button
              type="button"
              onClick={() => removePhoto(index)}
              className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        {photos.length < maxFiles && (
          <label className="w-20 h-20 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#8B7355] transition-colors">
            {isUploading ? (
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            ) : (
              <>
                <Upload className="w-6 h-6 text-gray-400" />
                <span className="text-xs text-gray-400 mt-1">Add</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
              disabled={isUploading}
            />
          </label>
        )}
      </div>
      <p className="text-xs text-gray-500">Max {maxFiles} images. Click to upload.</p>
    </div>
  );
}

function ImageGallery({ photos }: { photos: string[] }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  
  const validPhotos = (photos || []).filter(p => p && p.trim() !== '' && p !== 'null');

  if (validPhotos.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 bg-gray-100 rounded-lg">
        <div className="text-center text-gray-400">
          <ImageIcon className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">No images</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {validPhotos.map((photo, index) => (
          <img
            key={index}
            src={photo}
            alt={`Photo ${index + 1}`}
            className="w-full aspect-square object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => setSelectedIndex(index)}
          />
        ))}
      </div>

      <Dialog open={selectedIndex !== null} onOpenChange={() => setSelectedIndex(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl p-2">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {selectedIndex !== null && validPhotos[selectedIndex] && (
            <img
              src={validPhotos[selectedIndex]}
              alt={`Photo ${selectedIndex + 1}`}
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

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

  const { data: decorItems = [] } = useQuery<ProductionDecorItem[]>({
    queryKey: ['/api/inventory/production-decor-items'],
  });

  const { data: decorElements = [] } = useQuery<ProductionDecorElement[]>({
    queryKey: ['/api/inventory/production-decor-elements'],
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
          {activeSection === 'decor-planning' && (
            <DecorPlanningSection
              decorItems={decorItems}
              decorElements={decorElements}
              events={events}
              inventoryItems={inventoryItems}
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
    photos: [] as string[],
    isActive: true,
  });
  const [viewingItem, setViewingItem] = useState<InventoryItem | null>(null);
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);

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
      photos: [],
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
      photos: formData.photos,
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
      photos: item.photos || [],
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
        'Unit Cost': safeNumber(item.unitCost),
        'Total Value': item.stockQuantity * safeNumber(item.unitCost),
        'Location': item.location || '',
        'Status': item.isActive ? 'Active' : 'Inactive',
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
      ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 15 }, { wch: 20 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }, { wch: 20 }, { wch: 10 }];
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
                  <TableHead className="text-right">Total Value</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
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
                        <TableCell className="text-right font-semibold">{formatCurrency(item.stockQuantity * safeNumber(item.unitCost))}</TableCell>
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
                              onClick={() => setViewingItem(item)}
                              data-testid={`button-view-item-${item.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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
                <Popover open={categoryPopoverOpen} onOpenChange={setCategoryPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={categoryPopoverOpen}
                      className="w-full justify-between"
                      data-testid="select-item-category"
                    >
                      {formData.category || "Select category..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[250px] p-0">
                    <Command>
                      <CommandInput placeholder="Search category..." />
                      <CommandList>
                        <CommandEmpty>No category found.</CommandEmpty>
                        <CommandGroup>
                          {allCategories.map(cat => (
                            <CommandItem
                              key={cat}
                              value={cat}
                              onSelect={() => {
                                setFormData({ ...formData, category: cat });
                                setCategoryPopoverOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", formData.category === cat ? "opacity-100" : "opacity-0")} />
                              {cat}
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

            <ImageUpload 
              photos={formData.photos}
              onPhotosChange={(photos) => setFormData({ ...formData, photos })}
              maxFiles={5}
            />

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

      <Dialog open={!!viewingItem} onOpenChange={() => setViewingItem(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingItem?.name}</DialogTitle>
          </DialogHeader>
          {viewingItem && (
            <div className="space-y-4">
              <ImageGallery photos={viewingItem.photos || []} />
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Category</p>
                  <p className="font-medium">{viewingItem.category}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">SKU</p>
                  <p className="font-medium">{viewingItem.sku || '-'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Stock Quantity</p>
                  <p className="font-medium">{viewingItem.stockQuantity}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Min Stock Level</p>
                  <p className="font-medium">{viewingItem.minStockLevel || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Unit Cost</p>
                  <p className="font-medium">{formatCurrency(viewingItem.unitCost)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Location</p>
                  <p className="font-medium">{viewingItem.location || '-'}</p>
                </div>
              </div>
              
              {viewingItem.description && (
                <div>
                  <p className="text-muted-foreground text-sm">Description</p>
                  <p className="text-sm">{viewingItem.description}</p>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Badge variant={viewingItem.isActive ? "default" : "secondary"}>
                  {viewingItem.isActive ? 'Active' : 'Inactive'}
                </Badge>
                {viewingItem.stockQuantity < (viewingItem.minStockLevel || 0) && (
                  <Badge variant="destructive">Low Stock</Badge>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingItem(null)}>Close</Button>
            <Button onClick={() => { if (viewingItem) handleEdit(viewingItem); setViewingItem(null); }}>Edit</Button>
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
      
      const loadImage = (url: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = reject;
          img.src = url;
        });
      };

      try {
        const logoUrl = `${window.location.origin}/oak-street-logo.png`;
        const logoDataUrl = await loadImage(logoUrl);
        doc.addImage(logoDataUrl, 'PNG', 15, 8, 45, 18);
      } catch (e) {
        console.log('Delivery Note Logo could not be loaded:', e);
      }
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      const addressLines = COMPANY_DEFAULTS.address.split('\n');
      let headerY = 10;
      addressLines.forEach(line => {
        doc.text(line, pageWidth - 15, headerY, { align: 'right' });
        headerY += 4;
      });
      doc.text(`Phone: ${COMPANY_DEFAULTS.phone}`, pageWidth - 15, headerY, { align: 'right' });
      headerY += 4;
      doc.text(`Email: ${COMPANY_DEFAULTS.email}`, pageWidth - 15, headerY, { align: 'right' });
      headerY += 4;
      if (COMPANY_DEFAULTS.gstNumber) {
        doc.text(`GSTIN: ${COMPANY_DEFAULTS.gstNumber}`, pageWidth - 15, headerY, { align: 'right' });
      }
      
      y = 32;
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

const VENDOR_CATEGORIES = [
  'Catering',
  'Decoration',
  'Photography',
  'Videography',
  'Venue',
  'Lighting',
  'Sound',
  'Florist',
  'Entertainment',
  'Rental Equipment',
  'Transportation',
  'Makeup & Hair',
  'Invitation & Printing',
  'Other',
];

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
  const [activeSubTab, setActiveSubTab] = useState('rentals');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingRental, setEditingRental] = useState<RentalRecord | null>(null);
  const [selectedRental, setSelectedRental] = useState<RentalRecord | null>(null);

  const [isVendorModalOpen, setIsVendorModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [vendorFormData, setVendorFormData] = useState({
    name: '',
    email: '',
    phone: '',
    gstNumber: '',
    category: '',
    billingAddress: '',
    contactPerson: '',
    bankName: '',
    bankAccountNumber: '',
    bankIfsc: '',
    notes: '',
  });

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

  const createVendorMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/vendors', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      setIsVendorModalOpen(false);
      toast({ title: 'Vendor created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create vendor', description: error.message, variant: 'destructive' });
    },
  });

  const updateVendorMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest('PATCH', `/api/vendors/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      setIsVendorModalOpen(false);
      toast({ title: 'Vendor updated successfully' });
    },
  });

  const deleteVendorMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/vendors/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vendors'] });
      toast({ title: 'Vendor deleted' });
    },
    onError: (error: any) => {
      toast({ title: 'Cannot delete vendor', description: 'Vendor may be linked to rentals or bills', variant: 'destructive' });
    },
  });

  const handleVendorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: vendorFormData.name,
      email: vendorFormData.email || null,
      phone: vendorFormData.phone || null,
      gstNumber: vendorFormData.gstNumber || null,
      category: vendorFormData.category || null,
      billingAddress: vendorFormData.billingAddress || null,
    };
    if (editingVendor) {
      updateVendorMutation.mutate({ id: editingVendor.id, data });
    } else {
      createVendorMutation.mutate(data);
    }
  };

  const resetVendorForm = () => {
    setVendorFormData({
      name: '',
      email: '',
      phone: '',
      gstNumber: '',
      category: '',
      billingAddress: '',
      contactPerson: '',
      bankName: '',
      bankAccountNumber: '',
      bankIfsc: '',
      notes: '',
    });
    setEditingVendor(null);
  };

  const [itemFormData, setItemFormData] = useState({
    itemName: '',
    quantity: '1',
    unitRate: '',
    condition: '',
    quantityReturned: '0',
    damageNotes: '',
    photos: [] as string[],
  });

  const [editingItem, setEditingItem] = useState<RentalItem | null>(null);
  const [viewingRentalItem, setViewingRentalItem] = useState<RentalItem | null>(null);
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
      setItemFormData({ itemName: '', quantity: '1', unitRate: '', condition: '', quantityReturned: '0', damageNotes: '', photos: [] });
      toast({ title: 'Rental item added' });
    },
    onError: (error: any) => {
      console.error('Failed to add rental item:', error);
      toast({ title: 'Failed to add item', description: error.message, variant: 'destructive' });
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
      photos: itemFormData.photos,
    });
  };

  const resetItemForm = () => {
    setItemFormData({
      itemName: '',
      quantity: '1',
      unitRate: '',
      condition: '',
      quantityReturned: '0',
      damageNotes: '',
      photos: [],
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

  const handleDownloadRentalPDF = async () => {
    if (!selectedRental) return;
    try {
      const jsPDF = (await import('jspdf')).default;
      const vendorName = getVendorName(selectedRental.vendorId);
      const eventName = getEventName(selectedRental.eventId);
      const event = events.find(e => e.id === selectedRental.eventId);
      const vendor = vendors.find(v => v.id === selectedRental.vendorId);
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 15;
      
      const loadImage = (url: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = reject;
          img.src = url;
        });
      };

      try {
        const logoUrl = `${window.location.origin}/oak-street-logo.png`;
        const logoDataUrl = await loadImage(logoUrl);
        doc.addImage(logoDataUrl, 'PNG', 15, 8, 45, 18);
      } catch (e) {
        console.log('Rental PDF Logo could not be loaded:', e);
      }
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      const addressLines = COMPANY_DEFAULTS.address.split('\n');
      let headerY = 10;
      addressLines.forEach(line => {
        doc.text(line, pageWidth - 15, headerY, { align: 'right' });
        headerY += 4;
      });
      doc.text(`Phone: ${COMPANY_DEFAULTS.phone}`, pageWidth - 15, headerY, { align: 'right' });
      headerY += 4;
      doc.text(`Email: ${COMPANY_DEFAULTS.email}`, pageWidth - 15, headerY, { align: 'right' });
      headerY += 4;
      if (COMPANY_DEFAULTS.gstNumber) {
        doc.text(`GSTIN: ${COMPANY_DEFAULTS.gstNumber}`, pageWidth - 15, headerY, { align: 'right' });
      }
      
      y = 32;
      doc.setDrawColor(200);
      doc.line(15, y, pageWidth - 15, y);
      y += 10;
      
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text('RENTAL RECORD', pageWidth / 2, y, { align: 'center' });
      y += 12;
      
      doc.setFontSize(10);
      const leftCol = 15;
      const rightCol = pageWidth / 2 + 10;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Vendor:', leftCol, y);
      doc.setFont('helvetica', 'normal');
      const vendorText = doc.splitTextToSize(vendorName, 60);
      doc.text(vendorText, leftCol + 25, y);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Status:', rightCol, y);
      doc.setFont('helvetica', 'normal');
      doc.text(selectedRental.status.replace('_', ' ').toUpperCase(), rightCol + 20, y);
      y += vendorText.length > 1 ? vendorText.length * 5 : 7;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Event:', leftCol, y);
      doc.setFont('helvetica', 'normal');
      const eventText = doc.splitTextToSize(eventName, 60);
      doc.text(eventText, leftCol + 25, y);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Rental Date:', rightCol, y);
      doc.setFont('helvetica', 'normal');
      doc.text(format(new Date(selectedRental.rentalDate), 'dd/MM/yyyy'), rightCol + 30, y);
      y += eventText.length > 1 ? eventText.length * 5 : 7;
      
      if (event?.venue) {
        doc.setFont('helvetica', 'bold');
        doc.text('Venue:', leftCol, y);
        doc.setFont('helvetica', 'normal');
        const venueText = doc.splitTextToSize(event.venue, 60);
        doc.text(venueText, leftCol + 25, y);
      }
      
      if (selectedRental.expectedReturnDate) {
        doc.setFont('helvetica', 'bold');
        doc.text('Expected Return:', rightCol, y);
        doc.setFont('helvetica', 'normal');
        doc.text(format(new Date(selectedRental.expectedReturnDate), 'dd/MM/yyyy'), rightCol + 35, y);
      }
      y += 7;
      
      if (event?.customer) {
        doc.setFont('helvetica', 'bold');
        doc.text('Customer:', leftCol, y);
        doc.setFont('helvetica', 'normal');
        doc.text(event.customer, leftCol + 25, y);
        y += 7;
      }
      
      if (vendor?.billingAddress) {
        doc.setFont('helvetica', 'bold');
        doc.text('Vendor Address:', leftCol, y);
        doc.setFont('helvetica', 'normal');
        const addrText = doc.splitTextToSize(vendor.billingAddress, 140);
        doc.text(addrText, leftCol + 35, y);
        y += addrText.length * 5 + 2;
      }
      
      y += 8;
      
      doc.setFillColor(253, 246, 227);
      doc.rect(15, y - 5, pageWidth - 30, 8, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('SL', 17, y);
      doc.text('Item Name', 27, y);
      doc.text('Qty Issued', 85, y);
      doc.text('Qty Returned', 110, y);
      doc.text('Pending', 140, y);
      doc.text('Unit Rate', 160, y);
      doc.text('Condition', 185, y);
      y += 8;
      
      doc.setFont('helvetica', 'normal');
      let totalValue = 0;
      rentalItemsForSelected.forEach((item, index) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
          doc.setFillColor(253, 246, 227);
          doc.rect(15, y - 5, pageWidth - 30, 8, 'F');
          doc.setFont('helvetica', 'bold');
          doc.text('SL', 17, y);
          doc.text('Item Name', 27, y);
          doc.text('Qty Issued', 85, y);
          doc.text('Qty Returned', 110, y);
          doc.text('Pending', 140, y);
          doc.text('Unit Rate', 160, y);
          doc.text('Condition', 185, y);
          y += 8;
          doc.setFont('helvetica', 'normal');
        }
        
        const pending = item.quantity - (item.quantityReturned || 0);
        const rate = parseFloat(item.unitRate || '0');
        totalValue += rate * item.quantity;
        
        doc.text(String(index + 1), 17, y);
        const itemText = doc.splitTextToSize(item.itemName, 50);
        doc.text(itemText[0].substring(0, 28), 27, y);
        doc.text(String(item.quantity), 92, y);
        doc.text(String(item.quantityReturned || 0), 120, y);
        doc.text(String(pending), 145, y);
        doc.text(formatCurrency(item.unitRate || '0'), 160, y);
        doc.text((item.condition || '-').substring(0, 10), 185, y);
        
        y += itemText.length > 1 ? 8 : 6;
      });
      
      y += 5;
      doc.setDrawColor(200);
      doc.line(15, y, pageWidth - 15, y);
      y += 8;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Total Items:', pageWidth - 80, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(rentalItemsForSelected.length), pageWidth - 50, y);
      y += 6;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Total Value:', pageWidth - 80, y);
      doc.setFont('helvetica', 'normal');
      doc.text(formatCurrency(String(totalValue)), pageWidth - 50, y);
      y += 6;
      
      if (selectedRental.depositPaid && parseFloat(selectedRental.depositPaid) > 0) {
        doc.setFont('helvetica', 'bold');
        doc.text('Deposit Paid:', pageWidth - 80, y);
        doc.setFont('helvetica', 'normal');
        doc.text(formatCurrency(selectedRental.depositPaid), pageWidth - 50, y);
        y += 6;
      }
      
      if (selectedRental.notes) {
        y += 5;
        doc.setFont('helvetica', 'bold');
        doc.text('Notes:', leftCol, y);
        doc.setFont('helvetica', 'normal');
        const notesText = doc.splitTextToSize(selectedRental.notes, pageWidth - 45);
        doc.text(notesText, leftCol + 20, y);
        y += notesText.length * 5;
      }
      
      const itemsWithPhotos = rentalItemsForSelected.filter(item => item.photos && item.photos.length > 0);
      if (itemsWithPhotos.length > 0) {
        doc.addPage();
        y = 20;
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0);
        doc.text('Item Images', pageWidth / 2, y, { align: 'center' });
        y += 15;
        
        for (const item of itemsWithPhotos) {
          if (y > 240) {
            doc.addPage();
            y = 20;
          }
          
          doc.setFontSize(10);
          doc.setFont('helvetica', 'bold');
          doc.text(item.itemName, 15, y);
          y += 8;
          
          let x = 15;
          const imgWidth = 40;
          const imgHeight = 40;
          
          for (const photo of (item.photos || []).slice(0, 4)) {
            try {
              const imgDataUrl = await loadImage(photo);
              doc.addImage(imgDataUrl, 'PNG', x, y, imgWidth, imgHeight);
              x += imgWidth + 5;
              if (x > pageWidth - imgWidth - 15) {
                x = 15;
                y += imgHeight + 5;
              }
            } catch (e) {
              console.log('Could not load image:', photo, e);
            }
          }
          y += imgHeight + 15;
        }
      }
      
      y += 10;
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      
      doc.setDrawColor(200);
      doc.line(15, y, pageWidth - 15, y);
      y += 10;
      
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, y, { align: 'center' });
      y += 5;
      doc.text(`Total Items: ${rentalItemsForSelected.length}`, pageWidth / 2, y, { align: 'center' });
      
      const fileName = `Rental_${vendorName.replace(/[^a-z0-9]/gi, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
      doc.save(fileName);
      toast({ title: 'PDF Downloaded', description: `${fileName} has been downloaded` });
    } catch (error) {
      console.error('Error generating Rental PDF:', error);
      toast({ title: 'Error', description: 'Failed to generate PDF', variant: 'destructive' });
    }
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
          <h1 className="text-2xl font-bold">Rentals & Vendors</h1>
          <p className="text-muted-foreground">Manage rentals and global vendors</p>
        </div>
      </div>

      <Tabs value={activeSubTab} onValueChange={setActiveSubTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="rentals" data-testid="tab-rentals">Rentals</TabsTrigger>
          <TabsTrigger value="vendors" data-testid="tab-vendors">Global Vendors</TabsTrigger>
        </TabsList>

        <TabsContent value="rentals" className="space-y-6 mt-6">
          <div className="flex justify-end">
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
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelectedRental(rental); }} title="View items" data-testid={`button-view-rental-items-${rental.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
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

      {selectedRental && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Rental Items for {getVendorName(selectedRental.vendorId)}</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => { setItemFormData({ itemName: '', quantity: '1', unitRate: '', condition: '', quantityReturned: '0', damageNotes: '', photos: [] }); setIsItemModalOpen(true); }} data-testid="button-add-item-to-rental">
                <Plus className="w-4 h-4 mr-2" />
                Add Item
              </Button>
              {rentalItemsForSelected.length > 0 && (
                <>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadRentalPDF()} data-testid="button-download-rental-pdf">
                    <FileText className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDownloadRentalItems()} data-testid="button-download-rental-items">
                    <Download className="w-4 h-4 mr-2" />
                    Download Excel
                  </Button>
                </>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {rentalItemsForSelected.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <PackageOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No items added to this rental yet.</p>
                <p className="text-sm">Click "Add Item" to add rental items.</p>
              </div>
            ) : (
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
                            <Button variant="ghost" size="icon" onClick={() => setViewingRentalItem(item)} title="View item" data-testid={`button-view-rental-item-${item.id}`}>
                              <Eye className="h-4 w-4" />
                            </Button>
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
            )}
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
            <ImageUpload
              photos={itemFormData.photos}
              onPhotosChange={(photos) => setItemFormData({ ...itemFormData, photos })}
              maxFiles={5}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsItemModalOpen(false); resetItemForm(); }}>Cancel</Button>
              <Button type="submit" data-testid="button-submit-rental-item">Add Item</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingRentalItem} onOpenChange={() => setViewingRentalItem(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewingRentalItem?.itemName}</DialogTitle>
          </DialogHeader>
          {viewingRentalItem && (
            <div className="space-y-4">
              <ImageGallery photos={viewingRentalItem.photos || []} />
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Quantity</p>
                  <p className="font-medium">{viewingRentalItem.quantity}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Unit Rate</p>
                  <p className="font-medium">{formatCurrency(viewingRentalItem.unitRate)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Qty Returned</p>
                  <p className="font-medium">{viewingRentalItem.quantityReturned || 0}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Total</p>
                  <p className="font-medium">{formatCurrency(String(viewingRentalItem.quantity * parseFloat(viewingRentalItem.unitRate || '0')))}</p>
                </div>
              </div>
              
              {viewingRentalItem.condition && (
                <div>
                  <p className="text-muted-foreground text-sm">Condition</p>
                  <p className="text-sm">{viewingRentalItem.condition}</p>
                </div>
              )}
              
              {viewingRentalItem.returnCondition && (
                <div>
                  <p className="text-muted-foreground text-sm">Return Condition</p>
                  <p className="text-sm">{viewingRentalItem.returnCondition}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingRentalItem(null)}>Close</Button>
          </DialogFooter>
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
        </TabsContent>

        <TabsContent value="vendors" className="space-y-6 mt-6">
          <div className="flex justify-end">
            <Button onClick={() => { resetVendorForm(); setIsVendorModalOpen(true); }} data-testid="button-add-vendor">
              <Plus className="w-4 h-4 mr-2" />
              New Vendor
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Global Vendors ({vendors.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>GST Number</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendors.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No vendors found. Add your first vendor to get started.
                        </TableCell>
                      </TableRow>
                    ) : (
                      vendors.map(vendor => (
                        <TableRow key={vendor.id} data-testid={`row-vendor-${vendor.id}`}>
                          <TableCell className="font-medium">{vendor.name}</TableCell>
                          <TableCell>
                            {vendor.category && (
                              <Badge variant="outline">{vendor.category}</Badge>
                            )}
                          </TableCell>
                          <TableCell>{vendor.phone || '-'}</TableCell>
                          <TableCell>{vendor.email || '-'}</TableCell>
                          <TableCell>{vendor.gstNumber || '-'}</TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingVendor(vendor);
                                  setVendorFormData({
                                    name: vendor.name,
                                    email: vendor.email || '',
                                    phone: vendor.phone || '',
                                    gstNumber: vendor.gstNumber || '',
                                    category: vendor.category || '',
                                    billingAddress: vendor.billingAddress || '',
                                    contactPerson: '',
                                    bankName: '',
                                    bankAccountNumber: '',
                                    bankIfsc: '',
                                    notes: '',
                                  });
                                  setIsVendorModalOpen(true);
                                }}
                                data-testid={`button-edit-vendor-${vendor.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteVendorMutation.mutate(vendor.id)}
                                data-testid={`button-delete-vendor-${vendor.id}`}
                              >
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

          <Dialog open={isVendorModalOpen} onOpenChange={(open) => { setIsVendorModalOpen(open); if (!open) resetVendorForm(); }}>
            <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingVendor ? 'Edit Vendor' : 'Add New Vendor'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleVendorSubmit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Vendor Name *</Label>
                    <Input
                      value={vendorFormData.name}
                      onChange={(e) => setVendorFormData({ ...vendorFormData, name: e.target.value })}
                      required
                      placeholder="Enter vendor name"
                      data-testid="input-vendor-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={vendorFormData.category} onValueChange={(v) => setVendorFormData({ ...vendorFormData, category: v })}>
                      <SelectTrigger data-testid="select-vendor-category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {VENDOR_CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input
                      value={vendorFormData.phone}
                      onChange={(e) => setVendorFormData({ ...vendorFormData, phone: e.target.value })}
                      placeholder="Enter phone number"
                      data-testid="input-vendor-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={vendorFormData.email}
                      onChange={(e) => setVendorFormData({ ...vendorFormData, email: e.target.value })}
                      placeholder="Enter email address"
                      data-testid="input-vendor-email"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>GST Number</Label>
                    <Input
                      value={vendorFormData.gstNumber}
                      onChange={(e) => setVendorFormData({ ...vendorFormData, gstNumber: e.target.value.toUpperCase() })}
                      placeholder="e.g., 22AAAAA0000A1Z5"
                      data-testid="input-vendor-gst"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Billing Address</Label>
                  <Textarea
                    value={vendorFormData.billingAddress}
                    onChange={(e) => setVendorFormData({ ...vendorFormData, billingAddress: e.target.value })}
                    placeholder="Enter complete billing address"
                    rows={3}
                    data-testid="input-vendor-address"
                  />
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => { setIsVendorModalOpen(false); resetVendorForm(); }}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createVendorMutation.isPending || updateVendorMutation.isPending} data-testid="button-submit-vendor">
                    {editingVendor ? 'Update Vendor' : 'Add Vendor'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </TabsContent>
      </Tabs>
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
}: {
  plans: ProductionPlan[];
  tasks: ProductionTask[];
  events: Event[];
  vendors?: Vendor[];
  users?: User[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ProductionPlan | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ProductionPlan | null>(null);

  const [formData, setFormData] = useState({ name: '', eventId: '', status: 'draft' });
  const [taskFormData, setTaskFormData] = useState({ activity: '', taskDate: '', startTime: '', endTime: '', vendorName: '', responsiblePersonName: '', status: 'pending', notes: '' });
  const [editingTask, setEditingTask] = useState<ProductionTask | null>(null);
  const [eventSearchOpen, setEventSearchOpen] = useState(false);
  const [eventSearchValue, setEventSearchValue] = useState('');
  
  const [localVendors, setLocalVendors] = useState<string[]>([]);
  const [localPersons, setLocalPersons] = useState<string[]>([]);
  const [vendorInputOpen, setVendorInputOpen] = useState(false);
  const [personInputOpen, setPersonInputOpen] = useState(false);

  const allLocalVendors = useMemo(() => {
    const fromTasks = tasks.map(t => t.vendorId).filter(Boolean) as string[];
    return Array.from(new Set([...localVendors, ...fromTasks]));
  }, [localVendors, tasks]);

  const allLocalPersons = useMemo(() => {
    const fromTasks = tasks.map(t => t.responsiblePersonName).filter(Boolean) as string[];
    return Array.from(new Set([...localPersons, ...fromTasks]));
  }, [localPersons, tasks]);

  const filteredEvents = useMemo(() => {
    if (!eventSearchValue) return events;
    const search = eventSearchValue.toLowerCase();
    return events.filter(e => 
      e.title?.toLowerCase().includes(search) || 
      e.customer?.toLowerCase().includes(search)
    );
  }, [events, eventSearchValue]);

  const createPlanMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/inventory/production-plans', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production-plans'] });
      setIsModalOpen(false);
      toast({ title: 'Execution plan created' });
    },
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest('PATCH', `/api/inventory/production-plans/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production-plans'] });
      setIsModalOpen(false);
      toast({ title: 'Execution plan updated' });
    },
  });

  const deletePlanMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/inventory/production-plans/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production-plans'] });
      toast({ title: 'Execution plan deleted' });
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
    
    if (taskFormData.vendorName && !localVendors.includes(taskFormData.vendorName)) {
      setLocalVendors(prev => [...prev, taskFormData.vendorName]);
    }
    if (taskFormData.responsiblePersonName && !localPersons.includes(taskFormData.responsiblePersonName)) {
      setLocalPersons(prev => [...prev, taskFormData.responsiblePersonName]);
    }
    
    if (editingTask) {
      updateTaskMutation.mutate({
        id: editingTask.id,
        data: {
          activity: taskFormData.activity,
          taskDate: taskFormData.taskDate || null,
          startTime: taskFormData.startTime || null,
          endTime: taskFormData.endTime || null,
          vendorName: taskFormData.vendorName || null,
          responsiblePersonName: taskFormData.responsiblePersonName || null,
          status: taskFormData.status,
          notes: taskFormData.notes || null,
        }
      });
      setEditingTask(null);
      setIsTaskModalOpen(false);
    } else {
      addTaskMutation.mutate({
        planId: selectedPlan.id,
        activity: taskFormData.activity,
        taskDate: taskFormData.taskDate || null,
        startTime: taskFormData.startTime || null,
        endTime: taskFormData.endTime || null,
        vendorId: null,
        vendorName: taskFormData.vendorName || null,
        responsiblePersonId: null,
        responsiblePersonName: taskFormData.responsiblePersonName || null,
        status: taskFormData.status,
        notes: taskFormData.notes || null,
      });
    }
  };

  const handleEditTask = (task: ProductionTask) => {
    setEditingTask(task);
    setTaskFormData({
      activity: task.activity,
      taskDate: task.taskDate || '',
      startTime: task.startTime || '',
      endTime: task.endTime || '',
      vendorName: task.vendorName || '',
      responsiblePersonName: task.responsiblePersonName || '',
      status: task.status,
      notes: task.notes || '',
    });
    setIsTaskModalOpen(true);
  };

  const getEventName = (eventId: string | null) => events.find(e => e.id === eventId)?.title || 'N/A';

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = { draft: 'bg-gray-500', active: 'bg-blue-500', completed: 'bg-green-500', pending: 'bg-gray-500', in_progress: 'bg-amber-500' };
    return <Badge variant="default" className={colors[status] || 'bg-gray-500'}>{status.replace('_', ' ')}</Badge>;
  };

  const tasksForSelected = selectedPlan ? tasks.filter(t => t.planId === selectedPlan.id).sort((a, b) => {
    const dateA = a.taskDate || '9999-12-31';
    const dateB = b.taskDate || '9999-12-31';
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    const timeA = a.startTime || '99:99';
    const timeB = b.startTime || '99:99';
    return timeA.localeCompare(timeB);
  }) : [];

  const handleDownloadProductionPlanPDF = async () => {
    if (!selectedPlan) return;
    try {
      const jsPDF = (await import('jspdf')).default;
      const event = events.find(e => e.id === selectedPlan.eventId);
      const eventName = event?.title || 'N/A';
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 15;
      
      const loadImage = (url: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          };
          img.onerror = reject;
          img.src = url;
        });
      };

      try {
        const logoUrl = `${window.location.origin}/oak-street-logo.png`;
        const logoDataUrl = await loadImage(logoUrl);
        doc.addImage(logoDataUrl, 'PNG', 15, 8, 45, 18);
      } catch (e) {
        console.log('Execution Plan Logo could not be loaded:', e);
      }
      
      doc.setFontSize(11);
      doc.setTextColor(100);
      const addressLines = COMPANY_DEFAULTS.address.split('\n');
      let headerY = 10;
      addressLines.forEach(line => {
        doc.text(line, pageWidth - 15, headerY, { align: 'right' });
        headerY += 4;
      });
      doc.text(`Phone: ${COMPANY_DEFAULTS.phone}`, pageWidth - 15, headerY, { align: 'right' });
      headerY += 4;
      doc.text(`Email: ${COMPANY_DEFAULTS.email}`, pageWidth - 15, headerY, { align: 'right' });
      headerY += 4;
      if (COMPANY_DEFAULTS.gstNumber) {
        doc.text(`GSTIN: ${COMPANY_DEFAULTS.gstNumber}`, pageWidth - 15, headerY, { align: 'right' });
      }
      
      y = 32;
      doc.setDrawColor(200);
      doc.line(15, y, pageWidth - 15, y);
      y += 10;
      
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text('EXECUTION PLAN', pageWidth / 2, y, { align: 'center' });
      y += 12;
      
      doc.setFontSize(10);
      const leftCol = 15;
      const rightCol = pageWidth / 2 + 10;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Plan Name:', leftCol, y);
      doc.setFont('helvetica', 'normal');
      doc.text(selectedPlan.name, leftCol + 30, y);
      
      doc.setFont('helvetica', 'bold');
      doc.text('Status:', rightCol, y);
      doc.setFont('helvetica', 'normal');
      doc.text(selectedPlan.status.replace('_', ' ').toUpperCase(), rightCol + 20, y);
      y += 7;
      
      doc.setFont('helvetica', 'bold');
      doc.text('Event:', leftCol, y);
      doc.setFont('helvetica', 'normal');
      const eventText = doc.splitTextToSize(eventName, 70);
      doc.text(eventText, leftCol + 30, y);
      y += eventText.length > 1 ? eventText.length * 5 : 7;
      
      if (event?.date) {
        doc.setFont('helvetica', 'bold');
        doc.text('Event Date:', rightCol, y - (eventText.length > 1 ? (eventText.length - 1) * 5 : 0));
        doc.setFont('helvetica', 'normal');
        doc.text(format(new Date(event.date), 'dd/MM/yyyy'), rightCol + 30, y - (eventText.length > 1 ? (eventText.length - 1) * 5 : 0));
      }
      
      if (event?.venue) {
        doc.setFont('helvetica', 'bold');
        doc.text('Venue:', leftCol, y);
        doc.setFont('helvetica', 'normal');
        const venueText = doc.splitTextToSize(event.venue, 140);
        doc.text(venueText, leftCol + 30, y);
        y += venueText.length * 5 + 2;
      }
      
      if (event?.customer) {
        doc.setFont('helvetica', 'bold');
        doc.text('Customer:', leftCol, y);
        doc.setFont('helvetica', 'normal');
        doc.text(event.customer, leftCol + 30, y);
        y += 7;
      }
      
      y += 8;
      
      doc.setFillColor(253, 246, 227);
      doc.rect(15, y - 5, pageWidth - 30, 8, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('#', 17, y);
      doc.text('Activity', 24, y);
      doc.text('Date', 70, y);
      doc.text('Time', 95, y);
      doc.text('Vendor', 125, y);
      doc.text('Person', 155, y);
      doc.text('Status', 185, y);
      y += 8;
      
      doc.setFont('helvetica', 'normal');
      tasksForSelected.forEach((task, index) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
          doc.setFillColor(253, 246, 227);
          doc.rect(15, y - 5, pageWidth - 30, 8, 'F');
          doc.setFont('helvetica', 'bold');
          doc.text('#', 17, y);
          doc.text('Activity', 24, y);
          doc.text('Date', 70, y);
          doc.text('Time', 95, y);
          doc.text('Vendor', 125, y);
          doc.text('Person', 155, y);
          doc.text('Status', 185, y);
          y += 8;
          doc.setFont('helvetica', 'normal');
        }
        
        const dateStr = task.taskDate ? format(new Date(task.taskDate), 'dd/MM/yy') : '-';
        const timeStr = task.startTime && task.endTime 
          ? `${task.startTime}-${task.endTime}` 
          : task.startTime || task.endTime || '-';
        
        doc.text(String(index + 1), 17, y);
        const activityText = doc.splitTextToSize(task.activity, 42);
        doc.text(activityText[0].substring(0, 22), 24, y);
        doc.text(dateStr, 70, y);
        doc.text(timeStr.substring(0, 11), 95, y);
        doc.text((task.vendorName || '-').substring(0, 12), 125, y);
        doc.text((task.responsiblePersonName || '-').substring(0, 12), 155, y);
        doc.text(task.status.replace('_', ' '), 185, y);
        
        y += activityText.length > 1 ? 8 : 6;
      });
      
      y += 10;
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      
      doc.setDrawColor(200);
      doc.line(15, y, pageWidth - 15, y);
      y += 10;
      
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Generated on ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth / 2, y, { align: 'center' });
      y += 5;
      doc.text(`Total Tasks: ${tasksForSelected.length}`, pageWidth / 2, y, { align: 'center' });
      
      const fileName = `Execution_Plan_${selectedPlan.name.replace(/[^a-z0-9]/gi, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
      doc.save(fileName);
      toast({ title: 'PDF Downloaded', description: `${fileName} has been downloaded` });
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({ title: 'Error', description: 'Failed to generate PDF', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Execution Plans</h1>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <CardTitle>{selectedPlan ? `Tasks for ${selectedPlan.name}` : 'Select a Plan'}</CardTitle>
              {selectedPlan && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleDownloadProductionPlanPDF} data-testid="button-download-plan-pdf">
                    <Download className="w-4 h-4 mr-2" />
                    Download PDF
                  </Button>
                  <Button size="sm" onClick={() => { setEditingTask(null); setTaskFormData({ activity: '', taskDate: '', startTime: '', endTime: '', vendorName: '', responsiblePersonName: '', status: 'pending', notes: '' }); setIsTaskModalOpen(true); }} data-testid="button-add-task">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Task
                  </Button>
                </div>
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
                    <TableHead>Date</TableHead>
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
                        {task.taskDate ? format(new Date(task.taskDate), 'dd/MM/yyyy') : '-'}
                      </TableCell>
                      <TableCell className="text-sm">
                        {task.startTime && task.endTime ? `${task.startTime} - ${task.endTime}` : task.startTime || task.endTime || '-'}
                      </TableCell>
                      <TableCell>{task.vendorName || '-'}</TableCell>
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
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEditTask(task)} data-testid={`button-edit-task-${task.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => deleteTaskMutation.mutate(task.id)} data-testid={`button-delete-task-${task.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
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
            <DialogTitle>{editingPlan ? 'Edit Execution Plan' : 'New Execution Plan'}</DialogTitle>
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

      <Dialog open={isTaskModalOpen} onOpenChange={(open) => { setIsTaskModalOpen(open); if (!open) setEditingTask(null); }}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Add Task to Plan'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddTask} className="space-y-4">
            <div className="space-y-2">
              <Label>Activity *</Label>
              <Input value={taskFormData.activity} onChange={(e) => setTaskFormData({ ...taskFormData, activity: e.target.value })} required data-testid="input-task-activity" />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={taskFormData.taskDate} onChange={(e) => setTaskFormData({ ...taskFormData, taskDate: e.target.value })} data-testid="input-task-date" />
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
                <div className="relative">
                  <Input
                    value={taskFormData.vendorName}
                    onChange={(e) => {
                      setTaskFormData({ ...taskFormData, vendorName: e.target.value });
                    }}
                    onFocus={() => allLocalVendors.length > 0 && setVendorInputOpen(true)}
                    onBlur={() => setTimeout(() => setVendorInputOpen(false), 200)}
                    placeholder="Enter or select vendor"
                    data-testid="input-task-vendor"
                  />
                  {vendorInputOpen && allLocalVendors.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md">
                      <div className="p-2 text-xs text-muted-foreground font-medium">Previously used vendors</div>
                      <div className="max-h-40 overflow-y-auto">
                        {allLocalVendors
                          .filter(v => v.toLowerCase().includes(taskFormData.vendorName.toLowerCase()))
                          .map(v => (
                            <div
                              key={v}
                              className="px-3 py-2 hover:bg-muted cursor-pointer text-sm flex items-center"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setTaskFormData({ ...taskFormData, vendorName: v });
                                setVendorInputOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", taskFormData.vendorName === v ? "opacity-100" : "opacity-0")} />
                              {v}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Type a new vendor name or select from previously used</p>
              </div>
              <div className="space-y-2">
                <Label>Responsible Person</Label>
                <div className="relative">
                  <Input
                    value={taskFormData.responsiblePersonName}
                    onChange={(e) => {
                      setTaskFormData({ ...taskFormData, responsiblePersonName: e.target.value });
                    }}
                    onFocus={() => allLocalPersons.length > 0 && setPersonInputOpen(true)}
                    onBlur={() => setTimeout(() => setPersonInputOpen(false), 200)}
                    placeholder="Enter or select person"
                    data-testid="input-task-person"
                  />
                  {personInputOpen && allLocalPersons.length > 0 && (
                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md">
                      <div className="p-2 text-xs text-muted-foreground font-medium">Previously used persons</div>
                      <div className="max-h-40 overflow-y-auto">
                        {allLocalPersons
                          .filter(p => p.toLowerCase().includes(taskFormData.responsiblePersonName.toLowerCase()))
                          .map(p => (
                            <div
                              key={p}
                              className="px-3 py-2 hover:bg-muted cursor-pointer text-sm flex items-center"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setTaskFormData({ ...taskFormData, responsiblePersonName: p });
                                setPersonInputOpen(false);
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", taskFormData.responsiblePersonName === p ? "opacity-100" : "opacity-0")} />
                              {p}
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">Type a new name or select from previously used</p>
              </div>
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
              <Button type="button" variant="outline" onClick={() => { setIsTaskModalOpen(false); setEditingTask(null); }}>Cancel</Button>
              <Button type="submit" data-testid="button-submit-task">{editingTask ? 'Update Task' : 'Add Task'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const DECOR_TYPES = ['Stage', 'Entrance Arch', 'Backdrop', 'Photo Booth', 'Mandap', 'Aisle', 'Reception', 'Table Setup', 'Ceiling Decor', 'Other'];
const DECOR_STATUSES = ['pending', 'in_progress', 'completed', 'on_hold'];
const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'urgent'];
const ELEMENT_CATEGORIES = ['Flowers', 'Fabric', 'Props', 'Lighting', 'Furniture', 'Greenery', 'Accessories', 'Electronics', 'Other'];
const SOURCE_OPTIONS = ['in_stock', 'to_buy', 'to_rent'];

const PASTEL_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  blue: { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  pink: { bg: 'bg-pink-50', border: 'border-pink-200', badge: 'bg-pink-100 text-pink-700' },
  green: { bg: 'bg-green-50', border: 'border-green-200', badge: 'bg-green-100 text-green-700' },
  yellow: { bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  purple: { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
  orange: { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' },
  teal: { bg: 'bg-teal-50', border: 'border-teal-200', badge: 'bg-teal-100 text-teal-700' },
  rose: { bg: 'bg-rose-50', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-700' },
};

function DecorPlanningSection({
  decorItems,
  decorElements,
  events,
  inventoryItems,
  users,
}: {
  decorItems: ProductionDecorItem[];
  decorElements: ProductionDecorElement[];
  events: Event[];
  inventoryItems: InventoryItem[];
  users: User[];
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isElementModalOpen, setIsElementModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ProductionDecorItem | null>(null);
  const [editingElement, setEditingElement] = useState<ProductionDecorElement | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [viewingItem, setViewingItem] = useState<ProductionDecorItem | null>(null);
  
  const [filters, setFilters] = useState({
    eventDate: '',
    venue: '',
    decorType: 'all',
    status: 'all',
  });

  const [itemFormData, setItemFormData] = useState({
    eventId: '',
    eventName: '',
    eventDate: '',
    venue: '',
    decorType: 'Stage',
    setupDate: '',
    setupTime: '',
    estimatedDuration: '',
    priority: 'medium',
    manpowerRequired: '',
    teamLead: '',
    status: 'pending',
    pastelColor: 'blue',
    notes: '',
  });

  const [elementFormData, setElementFormData] = useState({
    decorItemId: '',
    elementName: '',
    categoryType: 'Other',
    quantity: '1',
    unit: 'Nos',
    linkedInventoryItemId: '',
    externalItemName: '',
    source: 'in_stock',
    assignedPersonVendor: '',
    notes: '',
  });

  const resetItemForm = () => {
    setItemFormData({
      eventId: '',
      eventName: '',
      eventDate: '',
      venue: '',
      decorType: 'Stage',
      setupDate: '',
      setupTime: '',
      estimatedDuration: '',
      priority: 'medium',
      manpowerRequired: '',
      teamLead: '',
      status: 'pending',
      pastelColor: 'blue',
      notes: '',
    });
    setEditingItem(null);
  };

  const resetElementForm = () => {
    setElementFormData({
      decorItemId: '',
      elementName: '',
      categoryType: 'Other',
      quantity: '1',
      unit: 'Nos',
      linkedInventoryItemId: '',
      externalItemName: '',
      source: 'in_stock',
      assignedPersonVendor: '',
      notes: '',
    });
    setEditingElement(null);
  };

  const filteredItems = useMemo(() => {
    return decorItems.filter(item => {
      const matchesEventDate = !filters.eventDate || item.eventDate === filters.eventDate;
      const matchesVenue = !filters.venue || (item.venue && item.venue.toLowerCase().includes(filters.venue.toLowerCase()));
      const matchesDecorType = filters.decorType === 'all' || item.decorType === filters.decorType;
      const matchesStatus = filters.status === 'all' || item.status === filters.status;
      return matchesEventDate && matchesVenue && matchesDecorType && matchesStatus;
    });
  }, [decorItems, filters]);

  const toggleCardExpand = (itemId: string) => {
    const newSet = new Set(expandedCards);
    if (newSet.has(itemId)) {
      newSet.delete(itemId);
    } else {
      newSet.add(itemId);
    }
    setExpandedCards(newSet);
  };

  const createItemMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/inventory/production-decor-items', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production-decor-items'] });
      setIsItemModalOpen(false);
      resetItemForm();
      toast({ title: 'Décor item created' });
    },
    onError: (error: any) => toast({ title: 'Failed to create item', description: error.message, variant: 'destructive' }),
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest('PATCH', `/api/inventory/production-decor-items/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production-decor-items'] });
      setIsItemModalOpen(false);
      resetItemForm();
      toast({ title: 'Décor item updated' });
    },
    onError: (error: any) => toast({ title: 'Failed to update item', description: error.message, variant: 'destructive' }),
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/inventory/production-decor-items/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production-decor-items'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production-decor-elements'] });
      toast({ title: 'Décor item deleted' });
    },
    onError: (error: any) => toast({ title: 'Failed to delete item', description: error.message, variant: 'destructive' }),
  });

  const createElementMutation = useMutation({
    mutationFn: async (data: any) => apiRequest('POST', '/api/inventory/production-decor-elements', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production-decor-elements'] });
      setIsElementModalOpen(false);
      resetElementForm();
      toast({ title: 'Element added' });
    },
    onError: (error: any) => toast({ title: 'Failed to add element', description: error.message, variant: 'destructive' }),
  });

  const updateElementMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => apiRequest('PATCH', `/api/inventory/production-decor-elements/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production-decor-elements'] });
      setIsElementModalOpen(false);
      resetElementForm();
      toast({ title: 'Element updated' });
    },
    onError: (error: any) => toast({ title: 'Failed to update element', description: error.message, variant: 'destructive' }),
  });

  const deleteElementMutation = useMutation({
    mutationFn: async (id: string) => apiRequest('DELETE', `/api/inventory/production-decor-elements/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/production-decor-elements'] });
      toast({ title: 'Element deleted' });
    },
    onError: (error: any) => toast({ title: 'Failed to delete element', description: error.message, variant: 'destructive' }),
  });

  const handleItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...itemFormData,
      eventId: itemFormData.eventId || null,
      manpowerRequired: itemFormData.manpowerRequired ? parseInt(itemFormData.manpowerRequired) : 0,
    };
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data });
    } else {
      createItemMutation.mutate(data);
    }
  };

  const handleElementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      ...elementFormData,
      decorItemId: selectedItemId || elementFormData.decorItemId,
      quantity: parseInt(elementFormData.quantity) || 1,
      linkedInventoryItemId: elementFormData.linkedInventoryItemId || null,
    };
    if (editingElement) {
      updateElementMutation.mutate({ id: editingElement.id, data });
    } else {
      createElementMutation.mutate(data);
    }
  };

  const handleEditItem = (item: ProductionDecorItem) => {
    setEditingItem(item);
    setItemFormData({
      eventId: item.eventId || '',
      eventName: item.eventName || '',
      eventDate: item.eventDate || '',
      venue: item.venue || '',
      decorType: item.decorType,
      setupDate: item.setupDate || '',
      setupTime: item.setupTime || '',
      estimatedDuration: item.estimatedDuration || '',
      priority: item.priority || 'medium',
      manpowerRequired: item.manpowerRequired?.toString() || '',
      teamLead: item.teamLead || '',
      status: item.status,
      pastelColor: item.pastelColor || 'blue',
      notes: item.notes || '',
    });
    setIsItemModalOpen(true);
  };

  const handleEditElement = (element: ProductionDecorElement) => {
    setEditingElement(element);
    setElementFormData({
      decorItemId: element.decorItemId,
      elementName: element.elementName,
      categoryType: element.categoryType || 'Other',
      quantity: element.quantity.toString(),
      unit: element.unit || 'Nos',
      linkedInventoryItemId: element.linkedInventoryItemId || '',
      externalItemName: element.externalItemName || '',
      source: element.source,
      assignedPersonVendor: element.assignedPersonVendor || '',
      notes: element.notes || '',
    });
    setIsElementModalOpen(true);
  };

  const handleAddElement = (itemId: string) => {
    setSelectedItemId(itemId);
    resetElementForm();
    setIsElementModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      on_hold: 'bg-amber-100 text-amber-700',
    };
    return <Badge className={colors[status] || 'bg-gray-100 text-gray-700'}>{status.replace('_', ' ')}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const colors: Record<string, string> = {
      low: 'bg-green-100 text-green-700',
      medium: 'bg-amber-100 text-amber-700',
      high: 'bg-orange-100 text-orange-700',
      urgent: 'bg-red-100 text-red-700',
    };
    return <Badge className={colors[priority] || 'bg-gray-100 text-gray-700'}>{priority}</Badge>;
  };

  const getSourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      in_stock: 'bg-green-100 text-green-700',
      to_buy: 'bg-blue-100 text-blue-700',
      to_rent: 'bg-purple-100 text-purple-700',
    };
    const labels: Record<string, string> = { in_stock: 'In Stock', to_buy: 'To Buy', to_rent: 'To Rent' };
    return <Badge className={colors[source] || 'bg-gray-100 text-gray-700'}>{labels[source] || source}</Badge>;
  };

  const handleDownloadPDF = async (item: ProductionDecorItem) => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const elements = decorElements.filter(e => e.decorItemId === item.id);
      
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      doc.setFontSize(18);
      doc.setTextColor(139, 115, 85);
      doc.text('DÉCOR PRODUCTION PLAN', pageWidth / 2, y, { align: 'center' });
      y += 15;

      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text(item.decorType, pageWidth / 2, y, { align: 'center' });
      y += 15;

      doc.setFontSize(10);
      doc.setTextColor(80);
      
      const leftCol = 20;
      const rightCol = pageWidth / 2 + 10;
      
      doc.text(`Event: ${item.eventName || 'N/A'}`, leftCol, y);
      doc.text(`Event Date: ${item.eventDate ? format(new Date(item.eventDate), 'dd MMM yyyy') : 'N/A'}`, rightCol, y);
      y += 7;
      
      doc.text(`Venue: ${item.venue || 'N/A'}`, leftCol, y);
      doc.text(`Status: ${item.status.replace('_', ' ')}`, rightCol, y);
      y += 7;
      
      doc.text(`Setup Date: ${item.setupDate ? format(new Date(item.setupDate), 'dd MMM yyyy') : 'N/A'}`, leftCol, y);
      doc.text(`Setup Time: ${item.setupTime || 'N/A'}`, rightCol, y);
      y += 7;
      
      doc.text(`Estimated Duration: ${item.estimatedDuration || 'N/A'}`, leftCol, y);
      doc.text(`Priority: ${item.priority || 'N/A'}`, rightCol, y);
      y += 7;
      
      doc.text(`Manpower Required: ${item.manpowerRequired || 0}`, leftCol, y);
      doc.text(`Team Lead: ${item.teamLead || 'N/A'}`, rightCol, y);
      y += 15;

      if (item.notes) {
        doc.text(`Notes: ${item.notes}`, leftCol, y);
        y += 10;
      }

      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text('Elements / Materials', leftCol, y);
      y += 8;

      doc.setFontSize(9);
      doc.setTextColor(80);
      
      const headers = ['Element', 'Category', 'Qty', 'Source', 'Assigned To'];
      const colWidths = [50, 30, 20, 25, 45];
      let x = leftCol;
      
      doc.setFillColor(245, 245, 245);
      doc.rect(leftCol, y - 4, pageWidth - 40, 8, 'F');
      
      headers.forEach((header, i) => {
        doc.text(header, x, y);
        x += colWidths[i];
      });
      y += 8;

      elements.forEach((el) => {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }
        
        x = leftCol;
        const invItem = inventoryItems.find(inv => inv.id === el.linkedInventoryItemId);
        const itemName = invItem?.name || el.externalItemName || el.elementName;
        
        doc.text(itemName.substring(0, 25), x, y);
        x += colWidths[0];
        doc.text(el.categoryType || '-', x, y);
        x += colWidths[1];
        doc.text(`${el.quantity} ${el.unit || ''}`, x, y);
        x += colWidths[2];
        doc.text(el.source.replace('_', ' '), x, y);
        x += colWidths[3];
        doc.text(el.assignedPersonVendor || '-', x, y);
        y += 6;
      });

      doc.save(`Decor-${item.decorType}-${item.eventName || 'Plan'}.pdf`);
      toast({ title: 'PDF downloaded' });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({ title: 'Failed to generate PDF', variant: 'destructive' });
    }
  };

  const clearFilters = () => {
    setFilters({ eventDate: '', venue: '', decorType: 'all', status: 'all' });
  };

  const getLinkedEvent = (eventId: string | null) => events.find(e => e.id === eventId);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Production Planning</h2>
          <p className="text-sm text-gray-500">Manage décor items and materials for events</p>
        </div>
        <Button 
          onClick={() => { resetItemForm(); setIsItemModalOpen(true); }} 
          className="bg-amber-600 hover:bg-amber-700"
          data-testid="button-add-decor-item"
        >
          <Plus className="w-4 h-4 mr-2" /> Add Décor Item
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Search className="w-4 h-4" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Event Date</Label>
              <Input 
                type="date" 
                value={filters.eventDate} 
                onChange={(e) => setFilters({ ...filters, eventDate: e.target.value })}
                data-testid="filter-event-date"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Venue</Label>
              <Input 
                placeholder="Search venue..." 
                value={filters.venue} 
                onChange={(e) => setFilters({ ...filters, venue: e.target.value })}
                data-testid="filter-venue"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Décor Type</Label>
              <Select value={filters.decorType} onValueChange={(v) => setFilters({ ...filters, decorType: v })}>
                <SelectTrigger data-testid="filter-decor-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {DECOR_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
                <SelectTrigger data-testid="filter-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {DECOR_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" size="sm" onClick={clearFilters} className="w-full">
                <RotateCcw className="w-3 h-3 mr-1" /> Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredItems.length === 0 ? (
        <Card className="p-8 text-center">
          <ClipboardList className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <p className="text-gray-500">No décor items found</p>
          <Button 
            variant="outline" 
            className="mt-4" 
            onClick={() => { resetItemForm(); setIsItemModalOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-2" /> Create Your First Décor Item
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const colorScheme = PASTEL_COLORS[item.pastelColor || 'blue'];
            const elements = decorElements.filter(e => e.decorItemId === item.id);
            const isExpanded = expandedCards.has(item.id);
            const linkedEvent = getLinkedEvent(item.eventId);

            return (
              <Card 
                key={item.id} 
                className={cn(
                  "border-2 transition-all hover:shadow-md",
                  colorScheme.bg,
                  colorScheme.border
                )}
                data-testid={`card-decor-item-${item.id}`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={colorScheme.badge}>{item.decorType}</Badge>
                        {getStatusBadge(item.status)}
                        {getPriorityBadge(item.priority || 'medium')}
                      </div>
                      <CardTitle className="text-lg mt-2 truncate">{item.eventName || 'Untitled Event'}</CardTitle>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => setViewingItem(item)}
                        data-testid={`button-view-decor-${item.id}`}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleEditItem(item)}
                        data-testid={`button-edit-decor-${item.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-red-500 hover:text-red-700"
                        onClick={() => {
                          if (confirm('Delete this décor item and all its elements?')) {
                            deleteItemMutation.mutate(item.id);
                          }
                        }}
                        data-testid={`button-delete-decor-${item.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Calendar className="w-3 h-3" />
                      <span>{item.eventDate ? format(new Date(item.eventDate), 'dd MMM yyyy') : 'No date'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <Building2 className="w-3 h-3" />
                      <span className="truncate">{item.venue || 'No venue'}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <Clock className="w-3 h-3" />
                      <span>{item.setupDate ? format(new Date(item.setupDate), 'dd MMM') : 'N/A'} {item.setupTime || ''}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-600">
                      <Users className="w-3 h-3" />
                      <span>{item.manpowerRequired || 0} people</span>
                    </div>
                  </div>
                  
                  {item.teamLead && (
                    <div className="text-xs text-gray-600">
                      <span className="font-medium">Team Lead:</span> {item.teamLead}
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-xs h-7"
                      onClick={() => toggleCardExpand(item.id)}
                      data-testid={`button-expand-${item.id}`}
                    >
                      <Package className="w-3 h-3 mr-1" />
                      {elements.length} Elements
                      <ChevronRight className={cn("w-3 h-3 ml-1 transition-transform", isExpanded && "rotate-90")} />
                    </Button>
                    <div className="flex gap-1">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={() => handleDownloadPDF(item)}
                        data-testid={`button-download-pdf-${item.id}`}
                      >
                        <Download className="w-3 h-3 mr-1" /> PDF
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={() => handleAddElement(item.id)}
                        data-testid={`button-add-element-${item.id}`}
                      >
                        <Plus className="w-3 h-3 mr-1" /> Add
                      </Button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pt-2 border-t">
                      {elements.length === 0 ? (
                        <p className="text-xs text-gray-500 text-center py-2">No elements added yet</p>
                      ) : (
                        <div className="overflow-x-auto -mx-4 px-4">
                          <Table>
                            <TableHeader>
                              <TableRow className="text-xs">
                                <TableHead className="py-2">Element</TableHead>
                                <TableHead className="py-2">Qty</TableHead>
                                <TableHead className="py-2">Source</TableHead>
                                <TableHead className="py-2 text-right">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {elements.map((el) => {
                                const invItem = inventoryItems.find(inv => inv.id === el.linkedInventoryItemId);
                                return (
                                  <TableRow key={el.id} className="text-xs">
                                    <TableCell className="py-2">
                                      <div>
                                        <p className="font-medium">{invItem?.name || el.externalItemName || el.elementName}</p>
                                        <p className="text-gray-500">{el.categoryType}</p>
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-2">{el.quantity} {el.unit}</TableCell>
                                    <TableCell className="py-2">{getSourceBadge(el.source)}</TableCell>
                                    <TableCell className="py-2 text-right">
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6"
                                        onClick={() => handleEditElement(el)}
                                        data-testid={`button-edit-element-${el.id}`}
                                      >
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6 text-red-500"
                                        onClick={() => {
                                          if (confirm('Delete this element?')) {
                                            deleteElementMutation.mutate(el.id);
                                          }
                                        }}
                                        data-testid={`button-delete-element-${el.id}`}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={isItemModalOpen} onOpenChange={(open) => { setIsItemModalOpen(open); if (!open) resetItemForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Edit Décor Item' : 'Add Décor Item'}</DialogTitle>
            <DialogDescription>Configure the décor item details for production planning</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleItemSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Event Name</Label>
                <Input 
                  value={itemFormData.eventName} 
                  onChange={(e) => setItemFormData({ ...itemFormData, eventName: e.target.value })}
                  placeholder="e.g., Sharma Wedding"
                  data-testid="input-event-name"
                />
              </div>
              <div className="space-y-2">
                <Label>Linked Event</Label>
                <Select value={itemFormData.eventId} onValueChange={(v) => {
                  const event = events.find(e => e.id === v);
                  setItemFormData({ 
                    ...itemFormData, 
                    eventId: v,
                    eventName: event?.title || itemFormData.eventName,
                    eventDate: event?.date || itemFormData.eventDate,
                    venue: event?.location || itemFormData.venue,
                  });
                }}>
                  <SelectTrigger data-testid="select-linked-event">
                    <SelectValue placeholder="Optional - link to event" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {events.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.title} - {e.date ? format(new Date(e.date), 'dd MMM yyyy') : 'No date'}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Event Date</Label>
                <Input 
                  type="date" 
                  value={itemFormData.eventDate} 
                  onChange={(e) => setItemFormData({ ...itemFormData, eventDate: e.target.value })}
                  data-testid="input-event-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Venue</Label>
                <Input 
                  value={itemFormData.venue} 
                  onChange={(e) => setItemFormData({ ...itemFormData, venue: e.target.value })}
                  placeholder="Event venue"
                  data-testid="input-venue"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Décor Type *</Label>
                <Select value={itemFormData.decorType} onValueChange={(v) => setItemFormData({ ...itemFormData, decorType: v })}>
                  <SelectTrigger data-testid="select-decor-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DECOR_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Card Color</Label>
                <Select value={itemFormData.pastelColor} onValueChange={(v) => setItemFormData({ ...itemFormData, pastelColor: v })}>
                  <SelectTrigger data-testid="select-card-color">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(PASTEL_COLORS).map(c => (
                      <SelectItem key={c} value={c}>
                        <span className="flex items-center gap-2">
                          <span className={cn("w-3 h-3 rounded-full", PASTEL_COLORS[c].bg, PASTEL_COLORS[c].border, "border")} />
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Setup Date</Label>
                <Input 
                  type="date" 
                  value={itemFormData.setupDate} 
                  onChange={(e) => setItemFormData({ ...itemFormData, setupDate: e.target.value })}
                  data-testid="input-setup-date"
                />
              </div>
              <div className="space-y-2">
                <Label>Setup Time</Label>
                <Input 
                  type="time" 
                  value={itemFormData.setupTime} 
                  onChange={(e) => setItemFormData({ ...itemFormData, setupTime: e.target.value })}
                  data-testid="input-setup-time"
                />
              </div>
              <div className="space-y-2">
                <Label>Estimated Duration</Label>
                <Input 
                  value={itemFormData.estimatedDuration} 
                  onChange={(e) => setItemFormData({ ...itemFormData, estimatedDuration: e.target.value })}
                  placeholder="e.g., 4 hours"
                  data-testid="input-duration"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select value={itemFormData.priority} onValueChange={(v) => setItemFormData({ ...itemFormData, priority: v })}>
                  <SelectTrigger data-testid="select-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(p => <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Manpower Required</Label>
                <Input 
                  type="number" 
                  value={itemFormData.manpowerRequired} 
                  onChange={(e) => setItemFormData({ ...itemFormData, manpowerRequired: e.target.value })}
                  placeholder="0"
                  data-testid="input-manpower"
                />
              </div>
              <div className="space-y-2">
                <Label>Team Lead</Label>
                <Input 
                  value={itemFormData.teamLead} 
                  onChange={(e) => setItemFormData({ ...itemFormData, teamLead: e.target.value })}
                  placeholder="Team lead name"
                  data-testid="input-team-lead"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={itemFormData.status} onValueChange={(v) => setItemFormData({ ...itemFormData, status: v })}>
                <SelectTrigger data-testid="select-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECOR_STATUSES.map(s => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                value={itemFormData.notes} 
                onChange={(e) => setItemFormData({ ...itemFormData, notes: e.target.value })}
                placeholder="Additional notes..."
                data-testid="input-notes"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsItemModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700" data-testid="button-submit-decor-item">
                {editingItem ? 'Update Item' : 'Create Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isElementModalOpen} onOpenChange={(open) => { setIsElementModalOpen(open); if (!open) resetElementForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingElement ? 'Edit Element' : 'Add Element'}</DialogTitle>
            <DialogDescription>Add materials or items needed for this décor</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleElementSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Element Name *</Label>
              <Input 
                value={elementFormData.elementName} 
                onChange={(e) => setElementFormData({ ...elementFormData, elementName: e.target.value })}
                placeholder="e.g., Rose Fresh Flowers"
                required
                data-testid="input-element-name"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category/Type</Label>
                <Select value={elementFormData.categoryType} onValueChange={(v) => setElementFormData({ ...elementFormData, categoryType: v })}>
                  <SelectTrigger data-testid="select-element-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ELEMENT_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Source *</Label>
                <Select value={elementFormData.source} onValueChange={(v) => setElementFormData({ ...elementFormData, source: v })}>
                  <SelectTrigger data-testid="select-element-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="in_stock">In Stock</SelectItem>
                    <SelectItem value="to_buy">To Buy</SelectItem>
                    <SelectItem value="to_rent">To Rent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Quantity *</Label>
                <Input 
                  type="number" 
                  value={elementFormData.quantity} 
                  onChange={(e) => setElementFormData({ ...elementFormData, quantity: e.target.value })}
                  min="1"
                  required
                  data-testid="input-element-quantity"
                />
              </div>
              <div className="space-y-2">
                <Label>Unit</Label>
                <Input 
                  value={elementFormData.unit} 
                  onChange={(e) => setElementFormData({ ...elementFormData, unit: e.target.value })}
                  placeholder="Nos, bunches, meters..."
                  data-testid="input-element-unit"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Link to Inventory Item</Label>
              <Select 
                value={elementFormData.linkedInventoryItemId} 
                onValueChange={(v) => setElementFormData({ ...elementFormData, linkedInventoryItemId: v })}
              >
                <SelectTrigger data-testid="select-linked-inventory">
                  <SelectValue placeholder="Optional - link to inventory" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {inventoryItems.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.name} ({inv.stockQuantity} in stock)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Or External Item Name</Label>
              <Input 
                value={elementFormData.externalItemName} 
                onChange={(e) => setElementFormData({ ...elementFormData, externalItemName: e.target.value })}
                placeholder="For items not in inventory"
                data-testid="input-external-item"
              />
            </div>

            <div className="space-y-2">
              <Label>Assigned Person/Vendor</Label>
              <Input 
                value={elementFormData.assignedPersonVendor} 
                onChange={(e) => setElementFormData({ ...elementFormData, assignedPersonVendor: e.target.value })}
                placeholder="Who will handle this?"
                data-testid="input-assigned-person"
              />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea 
                value={elementFormData.notes} 
                onChange={(e) => setElementFormData({ ...elementFormData, notes: e.target.value })}
                placeholder="Additional notes..."
                data-testid="input-element-notes"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsElementModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-amber-600 hover:bg-amber-700" data-testid="button-submit-element">
                {editingElement ? 'Update Element' : 'Add Element'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingItem} onOpenChange={(open) => { if (!open) setViewingItem(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Décor Item Details</DialogTitle>
          </DialogHeader>
          {viewingItem && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={PASTEL_COLORS[viewingItem.pastelColor || 'blue'].badge}>{viewingItem.decorType}</Badge>
                {getStatusBadge(viewingItem.status)}
                {getPriorityBadge(viewingItem.priority || 'medium')}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Event Name</p>
                  <p>{viewingItem.eventName || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Event Date</p>
                  <p>{viewingItem.eventDate ? format(new Date(viewingItem.eventDate), 'dd MMM yyyy') : 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Venue</p>
                  <p>{viewingItem.venue || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Setup Date & Time</p>
                  <p>{viewingItem.setupDate ? format(new Date(viewingItem.setupDate), 'dd MMM yyyy') : 'N/A'} {viewingItem.setupTime || ''}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Estimated Duration</p>
                  <p>{viewingItem.estimatedDuration || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Manpower Required</p>
                  <p>{viewingItem.manpowerRequired || 0} people</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Team Lead</p>
                  <p>{viewingItem.teamLead || 'N/A'}</p>
                </div>
              </div>

              {viewingItem.notes && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Notes</p>
                  <p className="text-sm">{viewingItem.notes}</p>
                </div>
              )}

              <div className="pt-4 border-t">
                <h4 className="font-medium mb-3">Elements ({decorElements.filter(e => e.decorItemId === viewingItem.id).length})</h4>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Element</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Assigned To</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {decorElements.filter(e => e.decorItemId === viewingItem.id).map((el) => {
                        const invItem = inventoryItems.find(inv => inv.id === el.linkedInventoryItemId);
                        return (
                          <TableRow key={el.id}>
                            <TableCell>{invItem?.name || el.externalItemName || el.elementName}</TableCell>
                            <TableCell>{el.categoryType || '-'}</TableCell>
                            <TableCell>{el.quantity} {el.unit}</TableCell>
                            <TableCell>{getSourceBadge(el.source)}</TableCell>
                            <TableCell>{el.assignedPersonVendor || '-'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => handleDownloadPDF(viewingItem)}>
                  <Download className="w-4 h-4 mr-2" /> Download PDF
                </Button>
                <Button onClick={() => { setViewingItem(null); handleEditItem(viewingItem); }}>
                  <Edit className="w-4 h-4 mr-2" /> Edit
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

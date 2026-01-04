import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  User, 
  CalendarDays, 
  DollarSign, 
  TrendingUp, 
  Star, 
  CreditCard, 
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Plus,
  Briefcase,
  Phone,
  Mail,
  MapPin,
  Building2,
  Receipt,
  PartyPopper,
  ClipboardList,
  Upload,
  Lock,
  Eye,
  EyeOff,
  Users,
  ArrowLeft,
  Shield,
  Trash2,
  Pencil
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { format, parseISO, differenceInDays } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { pageTransition, staggerContainer, staggerItem, TIMING } from "@/lib/animations";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { UserGuides } from "@/components/UserGuides";

interface EmployeeProfile {
  id: string;
  name: string;
  employeeId: string;
  userId: string | null;
  photoUrl: string | null;
  dateOfBirth: string | null;
  joinDate: string;
  designation: string;
  department: string | null;
  salary: string;
  address: string;
  emergencyContact: string;
  phone: string | null;
  email: string | null;
  totalLeavesPerYear: number | null;
  leaveDate: string | null;
}

interface LeaveBalance {
  id: string;
  employeeId: string;
  fiscalYear: string;
  totalLeaves: number;
  leavesUsed: number;
  leavesRemaining: number;
  carryForward: number;
}

interface LeaveRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  leaveType: string;
  categoryId: string | null;
  reason: string | null;
  status: string;
  createdAt: string;
}

interface LeaveCategory {
  id: string;
  name: string;
  description: string | null;
  defaultAnnualAllowance: number;
  isSystem: boolean;
}

interface EmployeeIncrement {
  id: string;
  employeeId: string;
  effectiveDate: string;
  previousSalary: string;
  newSalary: string;
  incrementAmount: string;
  incrementPercent: string | null;
  reason: string | null;
  notes: string | null;
}

interface EmployeeAppraisal {
  id: string;
  employeeId: string;
  reviewPeriodStart: string;
  reviewPeriodEnd: string;
  reviewDate: string;
  rating: number | null;
  ratingLabel: string | null;
  strengths: string | null;
  areasOfImprovement: string | null;
  goals: string | null;
  managerComments: string | null;
  status: string;
}

interface SalaryAdvanceRequest {
  id: string;
  employeeId: string;
  requestDate: string;
  amount: string;
  reason: string | null;
  repaymentMonths: number;
  status: string;
  approvedAmount: string | null;
  approvedDate: string | null;
  paidDate: string | null;
}

interface PayrollHistoryItem {
  runId: string;
  month: number;
  year: number;
  payDate: string | null;
  id: string;
  employeeId: string;
  employeeName: string;
  monthlySalary: string;
  daysWorked: number;
  dailyRate: string;
  grossPay: string;
  deductions: string;
  netPay: string;
}

interface ExpenseReimbursement {
  id: string;
  employeeId: string;
  requestDate: string;
  expenseDate: string;
  category: string;
  description: string;
  amount: string;
  voucherPath: string | null;
  status: string;
  approvedAmount: string | null;
  managerComments: string | null;
  approvedAt: string | null;
}

interface PublicHoliday {
  id: string;
  date: string;
  name: string;
  description: string | null;
  isNational: boolean;
  year: number;
}

interface EmployeeDuties {
  duties: string;
  responsibilities: string;
  designation: string;
  department: string | null;
}

interface QuickEntry {
  id: string;
  employeeId: string;
  source: string;
  filePath: string;
  amount: string | null;
  currency: string;
  transactionDate: string | null;
  direction: string | null;
  counterpartyName: string | null;
  counterpartyUpi: string | null;
  transactionId: string | null;
  confidence: string | null;
  status: string;
  eventId: string | null;
  categoryId: string | null;
  bankId: string | null;
  notes: string | null;
  reviewerNotes: string | null;
  createdAt: string;
}

function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  try {
    return format(parseISO(dateStr), 'dd MMM yyyy');
  } catch {
    return dateStr;
  }
}

function getStatusBadge(status: string) {
  const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: any }> = {
    pending: { variant: 'secondary', icon: Clock },
    approved: { variant: 'default', icon: CheckCircle2 },
    rejected: { variant: 'destructive', icon: XCircle },
    paid: { variant: 'default', icon: CheckCircle2 },
    repaid: { variant: 'outline', icon: CheckCircle2 },
  };
  const config = statusConfig[status] || { variant: 'secondary' as const, icon: AlertCircle };
  const Icon = config.icon;
  
  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon className="h-3 w-3" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function getRatingStars(rating: number | null) {
  if (!rating) return null;
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
        />
      ))}
    </div>
  );
}

function getMonthName(month: number): string {
  return new Date(2000, month - 1).toLocaleString('en-IN', { month: 'long' });
}

function QuickEntryTab() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingEntry, setEditingEntry] = useState<QuickEntry | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    amount: '',
    counterpartyName: '',
    eventId: '',
    notes: '',
    direction: 'paid' as 'paid' | 'received',
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch events for the dropdown
  const { data: events = [] } = useQuery<{ id: string; eventName: string; eventDate: string }[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await fetch('/api/events', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Handle shared screenshots from Web Share Target
  React.useEffect(() => {
    const loadFromCache = async (retries = 3): Promise<boolean> => {
      for (let i = 0; i < retries; i++) {
        try {
          const cache = await caches.open('oak-street-quick-entry-v2');
          const response = await cache.match('shared-screenshot');
          if (response) {
            const blob = await response.blob();
            const filename = response.headers.get('X-Filename') || 'shared-screenshot.jpg';
            const contentType = response.headers.get('Content-Type') || blob.type || 'image/jpeg';
            const file = new File([blob], filename, { type: contentType });
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => setPreviewUrl(reader.result as string);
            reader.readAsDataURL(file);
            await cache.delete('shared-screenshot');
            toast({ title: "Screenshot received", description: "Tap 'Process with AI' to extract payment details" });
            return true;
          }
          if (i < retries - 1) await new Promise(r => setTimeout(r, 300));
        } catch (error) {
          console.error('Error loading shared screenshot (attempt ' + (i+1) + '):', error);
        }
      }
      return false;
    };

    const handleSharedScreenshot = async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('share-target') === 'quick-entry') {
        console.log('[QuickEntry] Share target detected, loading from cache...');
        const loaded = await loadFromCache(5);
        if (loaded) {
          window.history.replaceState({}, '', '/employee-portal');
        } else {
          console.log('[QuickEntry] Could not load screenshot from cache');
          toast({ title: "Share Error", description: "Could not load the shared image. Please try again.", variant: "destructive" });
        }
      }
      if (params.get('share-error') === 'true') {
        toast({ title: "Share Error", description: "Failed to receive the shared image. Please try again.", variant: "destructive" });
        window.history.replaceState({}, '', '/employee-portal');
      }
    };
    handleSharedScreenshot();

    // Listen for messages from service worker
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'shared-screenshot') {
        console.log('[QuickEntry] Received message from service worker');
        await loadFromCache(3);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
  }, [toast]);

  const { data: quickEntries = [], isLoading } = useQuery<QuickEntry[]>({
    queryKey: ['/api/employee-portal/quick-entries'],
    queryFn: async () => {
      const res = await fetch('/api/employee-portal/quick-entries', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch quick entries');
      return res.json();
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      console.log('[QuickEntry] Starting upload, file:', file.name, file.type, file.size);
      
      // Step 1: Get upload URL
      console.log('[QuickEntry] Step 1: Getting upload URL...');
      const uploadRes = await fetch('/api/objects/upload', { method: 'POST', credentials: 'include' });
      if (!uploadRes.ok) {
        const errData = await uploadRes.json().catch(() => ({}));
        console.error('[QuickEntry] Step 1 failed:', uploadRes.status, errData);
        throw new Error(errData.error || 'Failed to get upload URL from server');
      }
      const { uploadURL } = await uploadRes.json();
      if (!uploadURL) throw new Error('Server did not provide upload URL');
      console.log('[QuickEntry] Step 1 complete, got URL');
      
      // Step 2: Upload file to signed URL with Content-Type
      console.log('[QuickEntry] Step 2: Uploading file to storage...');
      try {
        const putRes = await fetch(uploadURL, { 
          method: 'PUT', 
          body: file,
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
        });
        console.log('[QuickEntry] Step 2 response:', putRes.status, putRes.statusText);
        if (!putRes.ok) {
          const errText = await putRes.text().catch(() => '');
          console.error('[QuickEntry] Step 2 failed:', putRes.status, errText);
          throw new Error(`Failed to upload file to storage (${putRes.status})`);
        }
      } catch (err: any) {
        console.error('[QuickEntry] Step 2 exception:', err.message);
        throw new Error(`Failed to upload to storage: ${err.message}`);
      }
      console.log('[QuickEntry] Step 2 complete');
      
      // Step 3: Finalize upload
      console.log('[QuickEntry] Step 3: Finalizing upload...');
      const finalizeRes = await fetch('/api/objects/finalize', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadURL }),
        credentials: 'include',
      });
      if (!finalizeRes.ok) {
        console.error('[QuickEntry] Step 3 failed:', finalizeRes.status);
        throw new Error('Failed to finalize upload');
      }
      const { objectPath } = await finalizeRes.json();
      if (!objectPath) throw new Error('No file path received');
      console.log('[QuickEntry] Step 3 complete, path:', objectPath);
      
      // Step 4: Create quick entry record
      console.log('[QuickEntry] Step 4: Creating quick entry record...');
      const entryRes = await fetch('/api/employee-portal/quick-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: objectPath, source: 'upload' }),
        credentials: 'include',
      });
      if (!entryRes.ok) {
        console.error('[QuickEntry] Step 4 failed:', entryRes.status);
        throw new Error('Failed to create quick entry');
      }
      console.log('[QuickEntry] Step 4 complete');
      return entryRes.json();
    },
    onSuccess: (entry) => {
      processEntry(entry.id);
    },
    onError: (error: Error) => {
      console.error('Upload error:', error);
      toast({ title: "Upload Error", description: error.message, variant: "destructive" });
      setIsProcessing(false);
    },
  });

  const processEntry = async (entryId: string) => {
    if (!previewUrl) return;
    try {
      const res = await fetch(`/api/employee-portal/quick-entries/${entryId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: previewUrl }),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to process screenshot');
      const processedEntry = await res.json();
      toast({ title: "AI Processed", description: "Review the extracted details and add any additional information" });
      await queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/quick-entries'] });
      
      // Open edit dialog with processed data
      openEditDialog(processedEntry);
    } catch (error) {
      toast({ title: "Error", description: "Failed to process screenshot. Please try again.", variant: "destructive" });
    } finally {
      setIsProcessing(false);
      setSelectedFile(null);
      setPreviewUrl(null);
    }
  };

  const openEditDialog = (entry: QuickEntry) => {
    setEditingEntry(entry);
    setEditForm({
      amount: entry.amount || '',
      counterpartyName: entry.counterpartyName || '',
      eventId: entry.eventId || '',
      notes: entry.notes || '',
      direction: (entry.direction as 'paid' | 'received') || 'paid',
    });
    setIsEditDialogOpen(true);
  };

  const updateEntryMutation = useMutation({
    mutationFn: async (data: { id: string; updates: typeof editForm }) => {
      const payload = {
        ...data.updates,
        eventId: data.updates.eventId || null,
        status: 'awaiting_review',
      };
      const res = await fetch(`/api/employee-portal/quick-entries/${data.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to update entry');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Entry Updated", description: "Your entry has been submitted for review" });
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/quick-entries'] });
      setIsEditDialogOpen(false);
      setEditingEntry(null);
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveEntry = () => {
    if (!editingEntry) return;
    updateEntryMutation.mutate({ id: editingEntry.id, updates: editForm });
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    uploadMutation.mutate(selectedFile);
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      uploaded: { variant: 'secondary', label: 'Uploaded' },
      processing: { variant: 'secondary', label: 'Processing...' },
      awaiting_review: { variant: 'outline', label: 'Awaiting Review' },
      approved: { variant: 'default', label: 'Approved' },
      rejected: { variant: 'destructive', label: 'Rejected' },
      failed: { variant: 'destructive', label: 'Failed' },
    };
    const { variant, label } = config[status] || { variant: 'secondary', label: status };
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Quick Entry - AI Payment Scanner
          </CardTitle>
          <CardDescription>
            Upload or share a payment screenshot (UPI, GPay, PhonePe, etc.) and AI will automatically extract the details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 border-dashed rounded-lg p-6 text-center">
            {previewUrl ? (
              <div className="space-y-4">
                <img src={previewUrl} alt="Preview" className="max-h-48 mx-auto rounded-lg shadow" />
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={() => { setSelectedFile(null); setPreviewUrl(null); }} data-testid="button-cancel-upload">
                    Cancel
                  </Button>
                  <Button onClick={handleUpload} disabled={isProcessing} data-testid="button-process-screenshot">
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Process with AI
                      </>
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-12 w-12 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Tap to upload or share from your payment app
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  data-testid="input-file-upload"
                />
                <Button onClick={() => fileInputRef.current?.click()} data-testid="button-select-file">
                  Select Screenshot
                </Button>
              </div>
            )}
          </div>

          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p className="font-medium mb-2">Supported payment apps:</p>
            <p className="text-muted-foreground">
              Google Pay, PhonePe, Paytm, HDFC, ICICI, SBI, and most Indian bank apps
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Quick Entries</CardTitle>
          <CardDescription>Track the status of your submitted payment screenshots</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : quickEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No quick entries yet</p>
              <p className="text-sm">Upload a payment screenshot to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Vendor/Counterparty</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quickEntries.map((entry) => {
                  const eventName = events.find(e => e.id === entry.eventId)?.eventName;
                  return (
                    <TableRow key={entry.id} data-testid={`quick-entry-row-${entry.id}`}>
                      <TableCell>{formatDate(entry.transactionDate || entry.createdAt)}</TableCell>
                      <TableCell className="font-medium">
                        {entry.amount ? formatCurrency(entry.amount) : '-'}
                      </TableCell>
                      <TableCell>
                        {entry.direction === 'received' ? (
                          <Badge variant="outline" className="text-green-600">Received</Badge>
                        ) : entry.direction === 'paid' ? (
                          <Badge variant="outline" className="text-red-600">Paid</Badge>
                        ) : '-'}
                      </TableCell>
                      <TableCell>{entry.counterpartyName || '-'}</TableCell>
                      <TableCell className="max-w-[120px] truncate">{eventName || '-'}</TableCell>
                      <TableCell>{getStatusBadge(entry.status)}</TableCell>
                      <TableCell>
                        {(entry.status === 'awaiting_review' || entry.status === 'uploaded' || entry.status === 'processing') && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditDialog(entry)}
                            data-testid={`button-edit-entry-${entry.id}`}
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Entry Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Review & Edit Payment Details
            </DialogTitle>
            <DialogDescription>
              Review the AI-extracted information and add any additional details before submitting for approval
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-amount">Amount (₹)</Label>
                <Input
                  id="edit-amount"
                  type="number"
                  placeholder="Enter amount"
                  value={editForm.amount}
                  onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                  data-testid="input-edit-amount"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-direction">Payment Type</Label>
                <Select
                  value={editForm.direction}
                  onValueChange={(value: 'paid' | 'received') => setEditForm({ ...editForm, direction: value })}
                >
                  <SelectTrigger data-testid="select-edit-direction">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="paid">Paid (Expense)</SelectItem>
                    <SelectItem value="received">Received (Income)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-counterparty">Vendor / Counterparty Name</Label>
              <Input
                id="edit-counterparty"
                placeholder="Enter vendor or person name"
                value={editForm.counterpartyName}
                onChange={(e) => setEditForm({ ...editForm, counterpartyName: e.target.value })}
                data-testid="input-edit-counterparty"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-event">Related Event (Optional)</Label>
              <Select
                value={editForm.eventId || "none"}
                onValueChange={(value) => setEditForm({ ...editForm, eventId: value === "none" ? "" : value })}
              >
                <SelectTrigger data-testid="select-edit-event">
                  <SelectValue placeholder="Select an event (if applicable)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No event</SelectItem>
                  {events.map((event) => (
                    <SelectItem key={event.id} value={event.id}>
                      {event.eventName} - {formatDate(event.eventDate)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes / Description</Label>
              <Textarea
                id="edit-notes"
                placeholder="Add any additional notes or context..."
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={3}
                data-testid="textarea-edit-notes"
              />
            </div>

            {editingEntry?.transactionId && (
              <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                Transaction ID: {editingEntry.transactionId}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit">
              Cancel
            </Button>
            <Button 
              onClick={handleSaveEntry} 
              disabled={updateEntryMutation.isPending}
              data-testid="button-save-entry"
            >
              {updateEntryMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Submit for Review
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

// Employee Salary Slips Section
interface SalarySlip {
  id: string;
  payrollRunId: string;
  payrollItemId: string;
  employeeId: string;
  month: number;
  year: number;
  employeeName: string;
  designation: string | null;
  department: string | null;
  panNumber: string | null;
  location: string | null;
  joinDate: string | null;
  totalDays: number;
  daysPresent: number;
  daysPaid: number;
  basicPay: string;
  basicDa: string;
  hra: string | null;
  otherAllowances: string | null;
  transportationAllowance: string | null;
  totalEarnings: string;
  professionalTax: string | null;
  lossOfPay: string | null;
  transportDeduction: string | null;
  totalDeductions: string;
  netPayment: string;
  amountInWords: string | null;
  sentViaWhatsapp: boolean;
  sentAt: string | null;
  createdAt: string;
}

function EmployeeSalarySlipsSection({ employeeId }: { employeeId: string }) {
  const { data: salarySlips = [], isLoading } = useQuery<SalarySlip[]>({
    queryKey: ['/api/salary-slips/employee', employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/salary-slips/employee/${employeeId}`);
      if (!res.ok) throw new Error('Failed to fetch salary slips');
      return res.json();
    },
    enabled: !!employeeId,
  });
  
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  
  const downloadPDF = (slip: SalarySlip) => {
    import('jspdf').then(({ jsPDF }) => {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header with maroon background (Yepman branding)
      doc.setFillColor(157, 41, 102);
      doc.rect(0, 0, pageWidth, 35, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('YEPMAN INTERNATIONAL', pageWidth / 2, 15, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('2nd Floor, Above Devas Studio, Kaloor, Kochi-682017', pageWidth / 2, 22, { align: 'center' });
      doc.text('Tel: 7902373354', pageWidth / 2, 28, { align: 'center' });
      
      // Title
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('PAY SLIP', pageWidth / 2, 45, { align: 'center' });
      
      const monthLabel = `${monthNames[slip.month - 1]} ${slip.year}`;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`For the month of ${monthLabel}`, pageWidth / 2, 52, { align: 'center' });
      
      // Employee details box
      doc.setDrawColor(157, 41, 102);
      doc.setLineWidth(0.5);
      doc.rect(15, 58, pageWidth - 30, 30);
      
      doc.setFontSize(9);
      doc.text(`Employee Name: ${slip.employeeName}`, 20, 66);
      doc.text(`Designation: ${slip.designation || '-'}`, 20, 73);
      doc.text(`Department: ${slip.department || '-'}`, 20, 80);
      doc.text(`Location: ${slip.location || 'KOCHI'}`, 110, 66);
      doc.text(`PAN: ${slip.panNumber || '-'}`, 110, 73);
      doc.text(`Join Date: ${slip.joinDate || '-'}`, 110, 80);
      
      // Attendance section
      doc.setFillColor(157, 41, 102);
      doc.rect(15, 95, pageWidth - 30, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('ATTENDANCE', pageWidth / 2, 101, { align: 'center' });
      
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.rect(15, 103, pageWidth - 30, 15);
      doc.text(`Total Days: ${slip.totalDays}`, 25, 112);
      doc.text(`Days Present: ${slip.daysPresent}`, 75, 112);
      doc.text(`Days Paid: ${slip.daysPaid}`, 130, 112);
      
      // Earnings and Deductions
      let y = 125;
      doc.setFillColor(157, 41, 102);
      doc.rect(15, y, (pageWidth - 30) / 2, 8, 'F');
      doc.rect(15 + (pageWidth - 30) / 2, y, (pageWidth - 30) / 2, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.text('EARNINGS', 60, y + 6, { align: 'center' });
      doc.text('DEDUCTIONS', 145, y + 6, { align: 'center' });
      
      y += 8;
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.rect(15, y, (pageWidth - 30) / 2, 45);
      doc.rect(15 + (pageWidth - 30) / 2, y, (pageWidth - 30) / 2, 45);
      
      // Earnings
      doc.text('Basic + DA:', 20, y + 8);
      doc.text(slip.basicDa, 80, y + 8, { align: 'right' });
      doc.text('HRA:', 20, y + 16);
      doc.text(slip.hra || '0.00', 80, y + 16, { align: 'right' });
      doc.text('Other Allowances:', 20, y + 24);
      doc.text(slip.otherAllowances || '0.00', 80, y + 24, { align: 'right' });
      doc.text('Transportation:', 20, y + 32);
      doc.text(slip.transportationAllowance || '0.00', 80, y + 32, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text('Total Earnings:', 20, y + 40);
      doc.text(slip.totalEarnings, 80, y + 40, { align: 'right' });
      
      // Deductions
      doc.setFont('helvetica', 'normal');
      doc.text('Professional Tax:', 105, y + 8);
      doc.text(slip.professionalTax || '0.00', 180, y + 8, { align: 'right' });
      doc.text('Loss of Pay:', 105, y + 16);
      doc.text(slip.lossOfPay || '0.00', 180, y + 16, { align: 'right' });
      doc.text('Transport Deduction:', 105, y + 24);
      doc.text(slip.transportDeduction || '0.00', 180, y + 24, { align: 'right' });
      doc.setFont('helvetica', 'bold');
      doc.text('Total Deductions:', 105, y + 40);
      doc.text(slip.totalDeductions, 180, y + 40, { align: 'right' });
      
      // Net Payment
      y += 52;
      doc.setFillColor(157, 41, 102);
      doc.rect(15, y, pageWidth - 30, 12, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text('NET PAYMENT:', 20, y + 8);
      doc.text(`Rs. ${slip.netPayment}`, pageWidth - 20, y + 8, { align: 'right' });
      
      // Amount in words
      y += 18;
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.text(`(${slip.amountInWords || ''})`, pageWidth / 2, y, { align: 'center' });
      
      // Signature section
      y += 25;
      doc.setFont('helvetica', 'normal');
      doc.line(15, y, 70, y);
      doc.line(pageWidth - 70, y, pageWidth - 15, y);
      doc.text("Employee's Signature", 42.5, y + 8, { align: 'center' });
      doc.text("For Yepman International", pageWidth - 42.5, y + 8, { align: 'center' });
      
      // Footer
      y += 25;
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text('This is a computer generated document.', pageWidth / 2, y, { align: 'center' });
      
      doc.save(`Salary_Slip_${slip.employeeName.replace(/\s+/g, '_')}_${monthNames[slip.month - 1]}_${slip.year}.pdf`);
    });
  };
  
  return (
    <motion.div variants={staggerItem} initial="initial" animate="animate">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Salary Slips
          </CardTitle>
          <CardDescription>Download your monthly salary slips</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : salarySlips.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No salary slips available yet.</p>
              <p className="text-sm">Your salary slips will appear here once generated.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Month</TableHead>
                    <TableHead>Total Days</TableHead>
                    <TableHead>Days Paid</TableHead>
                    <TableHead className="text-right">Net Payment</TableHead>
                    <TableHead className="text-center">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salarySlips.map((slip) => (
                    <TableRow key={slip.id} data-testid={`row-salary-slip-${slip.id}`}>
                      <TableCell className="font-medium">
                        {monthNames[slip.month - 1]} {slip.year}
                      </TableCell>
                      <TableCell>{slip.totalDays}</TableCell>
                      <TableCell>{slip.daysPaid}</TableCell>
                      <TableCell className="text-right font-medium">
                        Rs. {parseFloat(slip.netPayment).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => downloadPDF(slip)}
                          data-testid={`button-download-slip-${slip.id}`}
                        >
                          <Receipt className="h-4 w-4 mr-1" />
                          PDF
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
    </motion.div>
  );
}

export default function EmployeePortal() {
  const [location, setLocation] = useLocation();
  
  // Get tab from URL query params - read once on mount
  const getTabFromUrl = () => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      // Handle share target redirect - go directly to quick-entry tab
      if (params.get('share-target') === 'quick-entry') {
        return 'quick-entry';
      }
      return params.get('tab') || 'overview';
    }
    return 'overview';
  };
  
  const [activeTab, setActiveTab] = useState(getTabFromUrl);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isAdvanceDialogOpen, setIsAdvanceDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | string | null>(null);
  const [editingLeave, setEditingLeave] = useState<LeaveRequest | null>(null);
  const [editingAdvance, setEditingAdvance] = useState<SalaryAdvanceRequest | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseReimbursement | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Update URL when tab changes - use replaceState to avoid back button issues
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    // Only update URL, don't use wouter navigation to avoid page refresh
    const newUrl = tab === 'overview' ? '/employee-portal' : `/employee-portal?tab=${tab}`;
    window.history.replaceState(null, '', newUrl);
  };
  
  const canViewOtherEmployees = user?.role === 'superadmin' || user?.role === 'admin' || user?.role === 'manager';

  const { data: profile, isLoading: profileLoading, error: profileError } = useQuery<EmployeeProfile>({
    queryKey: ['/api/employee-portal/profile'],
    queryFn: async () => {
      const res = await fetch('/api/employee-portal/profile');
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('PROFILE_NOT_FOUND');
        }
        throw new Error('Failed to fetch profile');
      }
      return res.json();
    },
  });

  const { data: leaveBalance } = useQuery<LeaveBalance>({
    queryKey: ['/api/employee-portal/leave-balance'],
    enabled: !!profile,
  });

  const { data: leaveRequests = [] } = useQuery<LeaveRequest[]>({
    queryKey: ['/api/employee-portal/leave-requests'],
    enabled: !!profile,
  });

  const { data: increments = [] } = useQuery<EmployeeIncrement[]>({
    queryKey: ['/api/employee-portal/increments'],
    enabled: !!profile,
  });

  const { data: appraisals = [] } = useQuery<EmployeeAppraisal[]>({
    queryKey: ['/api/employee-portal/appraisals'],
    enabled: !!profile,
  });

  const { data: salaryAdvances = [] } = useQuery<SalaryAdvanceRequest[]>({
    queryKey: ['/api/employee-portal/salary-advances'],
    enabled: !!profile,
  });

  const { data: payrollHistory = [] } = useQuery<PayrollHistoryItem[]>({
    queryKey: ['/api/employee-portal/payroll-history'],
    enabled: !!profile,
  });

  const { data: expenseReimbursements = [] } = useQuery<ExpenseReimbursement[]>({
    queryKey: ['/api/employee-portal/expense-reimbursements'],
    enabled: !!profile,
  });

  const { data: publicHolidays = [] } = useQuery<PublicHoliday[]>({
    queryKey: ['/api/public-holidays'],
    queryFn: async () => {
      const currentYear = new Date().getFullYear();
      const res = await fetch(`/api/public-holidays?year=${currentYear}`);
      if (!res.ok) throw new Error('Failed to fetch holidays');
      return res.json();
    },
    enabled: !!profile,
  });

  const { data: leaveCategories = [] } = useQuery<LeaveCategory[]>({
    queryKey: ['/api/leave-categories'],
    queryFn: async () => {
      const res = await fetch('/api/leave-categories');
      if (!res.ok) throw new Error('Failed to fetch leave categories');
      return res.json();
    },
  });

  const { data: employeeDuties } = useQuery<EmployeeDuties>({
    queryKey: ['/api/employee-portal/duties'],
    enabled: !!profile,
  });

  // Query for managed employees (managers/superadmins)
  const { data: managedEmployees = [] } = useQuery<EmployeeProfile[]>({
    queryKey: ['/api/employee-portal/managed-employees'],
    queryFn: async () => {
      const res = await fetch('/api/employee-portal/managed-employees', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: canViewOtherEmployees,
  });

  // Query for viewing a specific employee's portal (when selected)
  const { data: viewedEmployeeData, isLoading: viewingLoading } = useQuery<{
    employee: EmployeeProfile;
    increments: EmployeeIncrement[];
    appraisals: EmployeeAppraisal[];
    leaveBalance: LeaveBalance;
    leaveRequests: LeaveRequest[];
    salaryAdvances: SalaryAdvanceRequest[];
    expenses: ExpenseReimbursement[];
  }>({
    queryKey: ['/api/employee-portal/view', selectedEmployeeId],
    queryFn: async () => {
      const res = await fetch(`/api/employee-portal/view/${selectedEmployeeId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load employee data');
      return res.json();
    },
    enabled: !!selectedEmployeeId && canViewOtherEmployees,
  });

  // Password change mutation
  const changePasswordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: { currentPassword: string; newPassword: string }) => {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to change password');
      }
      return res.json();
    },
    onSuccess: () => {
      setIsPasswordDialogOpen(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast({
        title: "Success",
        description: "Password changed successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }
    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  const submitLeaveRequest = useMutation({
    mutationFn: async (data: { startDate: string; endDate: string; leaveType: string; categoryId: string; reason: string }) => {
      const res = await fetch('/api/employee-portal/leave-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to submit leave request');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/leave-requests'] });
      setIsLeaveDialogOpen(false);
      toast({
        title: "Success",
        description: "Leave request submitted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit leave request",
        variant: "destructive",
      });
    },
  });

  const submitAdvanceRequest = useMutation({
    mutationFn: async (data: { amount: string; reason: string; repaymentMonths: number }) => {
      const res = await fetch('/api/employee-portal/salary-advances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to submit salary advance request');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/salary-advances'] });
      setIsAdvanceDialogOpen(false);
      toast({
        title: "Success",
        description: "Salary advance request submitted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit salary advance request",
        variant: "destructive",
      });
    },
  });

  const submitExpenseReimbursement = useMutation({
    mutationFn: async (data: { expenseDate: string; category: string; description: string; amount: string }) => {
      const res = await fetch('/api/employee-portal/expense-reimbursements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to submit expense reimbursement request');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/expense-reimbursements'] });
      setIsExpenseDialogOpen(false);
      toast({
        title: "Success",
        description: "Expense reimbursement request submitted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to submit expense reimbursement request",
        variant: "destructive",
      });
    },
  });

  // Delete mutations for pending requests
  const deleteLeaveRequest = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employee-portal/leave-requests/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/leave-requests'] });
      toast({ title: "Success", description: "Leave request deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteSalaryAdvance = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employee-portal/salary-advances/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/salary-advances'] });
      toast({ title: "Success", description: "Salary advance request deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteExpenseReimbursement = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employee-portal/expense-reimbursements/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to delete');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/expense-reimbursements'] });
      toast({ title: "Success", description: "Expense request deleted" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Update mutations for pending requests
  const updateLeaveRequest = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/employee-portal/leave-requests/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/leave-requests'] });
      setEditingLeave(null);
      toast({ title: "Success", description: "Leave request updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateSalaryAdvance = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/employee-portal/salary-advances/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/salary-advances'] });
      setEditingAdvance(null);
      toast({ title: "Success", description: "Salary advance request updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateExpenseReimbursement = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/employee-portal/expense-reimbursements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to update');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/employee-portal/expense-reimbursements'] });
      setEditingExpense(null);
      toast({ title: "Success", description: "Expense request updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  // Check if user can edit/delete (employee owner or superadmin)
  const canEditDelete = (status: string) => status === 'pending';
  const isSuperadmin = user?.role === 'superadmin';

  if (profileLoading) {
    return (
      <motion.div 
        className="flex items-center justify-center min-h-[400px]"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </motion.div>
    );
  }

  if (profileError) {
    const errorMessage = (profileError as Error).message;
    if (errorMessage === 'PROFILE_NOT_FOUND') {
      // For superadmin/admin without employee profile, show admin view with team access
      if (canViewOtherEmployees) {
        return (
          <motion.div 
            className="space-y-6 p-4 md:p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: TIMING.fast }}
          >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-oak-dark pl-12 md:pl-0">Employee Portal</h1>
                <p className="text-muted-foreground pl-12 md:pl-0">Admin View - Manage your team</p>
              </div>
              <div className="flex gap-2">
                {isSuperadmin && (
                  <Link href="/hr">
                    <Button className="gap-2 bg-[#7C8B5D] hover:bg-[#6a7a4d]" data-testid="button-add-new-employee">
                      <Plus className="h-4 w-4" />
                      Add New Employee
                    </Button>
                  </Link>
                )}
                {managedEmployees.length > 0 && (
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="gap-2" data-testid="button-view-team">
                        <Users className="h-4 w-4" />
                        View Team ({managedEmployees.length})
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          {user?.role === 'superadmin' ? 'All Employees' : 'Your Team'}
                        </DialogTitle>
                        <DialogDescription>
                          {user?.role === 'superadmin' 
                            ? 'View any employee portal as superadmin'
                            : 'View portals of employees assigned to you'
                          }
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-2">
                        {managedEmployees.map((emp) => (
                          <div 
                            key={emp.id}
                            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => {
                              setSelectedEmployeeId(emp.id);
                            }}
                            data-testid={`employee-card-${emp.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <User className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <div className="font-medium">{emp.name}</div>
                                <div className="text-sm text-muted-foreground">{emp.designation}</div>
                              </div>
                            </div>
                            <div className="text-right text-sm">
                              <div className="font-mono text-muted-foreground">{emp.employeeId}</div>
                              <div className="text-muted-foreground">{emp.department || 'No Dept'}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </div>

            {/* Info card for admin without profile */}
            <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <CardContent className="flex items-center gap-4 p-6">
                <User className="h-12 w-12 text-blue-500" />
                <div>
                  <h3 className="font-semibold text-lg">No Personal Employee Profile</h3>
                  <p className="text-muted-foreground">
                    You don't have an employee profile linked to your account. As an admin, you can still view and manage your team members using the "View Team" button above.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Entry Tab for Admin */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Quick Entry - Upload Expense Screenshots
                </CardTitle>
                <CardDescription>
                  Upload payment screenshots and let AI extract the details automatically
                </CardDescription>
              </CardHeader>
              <CardContent>
                <QuickEntryTab />
              </CardContent>
            </Card>

            {/* Viewed Employee Dialog */}
            <Dialog open={!!selectedEmployeeId} onOpenChange={(open) => !open && setSelectedEmployeeId(null)}>
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                {viewingLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : viewedEmployeeData ? (
                  <>
                    <DialogHeader>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedEmployeeId(null)}>
                          <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                          <DialogTitle className="flex items-center gap-2">
                            {viewedEmployeeData.employee.name}
                            <Badge variant="outline">{viewedEmployeeData.employee.employeeId}</Badge>
                          </DialogTitle>
                          <DialogDescription>
                            {viewedEmployeeData.employee.designation} • {viewedEmployeeData.employee.department || 'No Department'}
                          </DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>
                    <div className="grid gap-4">
                      {/* Employee Overview */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <Card>
                          <CardContent className="p-3">
                            <div className="text-xs text-muted-foreground">Salary</div>
                            <div className="font-semibold">{formatCurrency(viewedEmployeeData.employee.salary)}</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-3">
                            <div className="text-xs text-muted-foreground">Join Date</div>
                            <div className="font-semibold">{formatDate(viewedEmployeeData.employee.joinDate)}</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-3">
                            <div className="text-xs text-muted-foreground">Leave Balance</div>
                            <div className="font-semibold">
                              {viewedEmployeeData.leaveBalance?.leavesRemaining || 0} days
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-3">
                            <div className="text-xs text-muted-foreground">Pending Requests</div>
                            <div className="font-semibold">
                              {(viewedEmployeeData.leaveRequests?.filter(r => r.status === 'pending').length || 0) +
                               (viewedEmployeeData.salaryAdvances?.filter(r => r.status === 'pending').length || 0) +
                               (viewedEmployeeData.expenses?.filter(r => r.status === 'pending').length || 0)}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                      
                      {/* Contact Info */}
                      <Card>
                        <CardHeader className="py-3">
                          <CardTitle className="text-sm">Contact Information</CardTitle>
                        </CardHeader>
                        <CardContent className="py-2 grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-muted-foreground">Email:</span> {viewedEmployeeData.employee.email || '-'}</div>
                          <div><span className="text-muted-foreground">Phone:</span> {viewedEmployeeData.employee.phone || '-'}</div>
                          <div className="col-span-2"><span className="text-muted-foreground">Address:</span> {viewedEmployeeData.employee.address}</div>
                          <div className="col-span-2"><span className="text-muted-foreground">Emergency:</span> {viewedEmployeeData.employee.emergencyContact}</div>
                        </CardContent>
                      </Card>

                      {/* Recent Activity */}
                      {(viewedEmployeeData.leaveRequests.length > 0 || viewedEmployeeData.salaryAdvances.length > 0 || viewedEmployeeData.expenses.length > 0) && (
                        <Card>
                          <CardHeader className="py-3">
                            <CardTitle className="text-sm">Recent Requests</CardTitle>
                          </CardHeader>
                          <CardContent className="py-2 space-y-2 max-h-48 overflow-y-auto">
                            {viewedEmployeeData.leaveRequests.slice(0, 5).map(req => (
                              <div key={req.id} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                                <span>Leave: {formatDate(req.startDate)} - {formatDate(req.endDate)}</span>
                                {getStatusBadge(req.status)}
                              </div>
                            ))}
                            {viewedEmployeeData.salaryAdvances.slice(0, 3).map(req => (
                              <div key={req.id} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                                <span>Advance: {formatCurrency(req.amount)}</span>
                                {getStatusBadge(req.status)}
                              </div>
                            ))}
                            {viewedEmployeeData.expenses.slice(0, 3).map(req => (
                              <div key={req.id} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                                <span>Expense: {formatCurrency(req.amount)} - {req.category}</span>
                                {getStatusBadge(req.status)}
                              </div>
                            ))}
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Failed to load employee data
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </motion.div>
        );
      }

      return (
        <motion.div 
          className="flex flex-col items-center justify-center min-h-[400px] text-center p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: TIMING.fast }}
        >
          <User className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Employee Profile Found</h2>
          <p className="text-muted-foreground max-w-md">
            Your user account is not linked to an employee profile. Please contact your administrator to link your account.
          </p>
        </motion.div>
      );
    }
    
    return (
      <motion.div 
        className="flex flex-col items-center justify-center min-h-[400px] text-center p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <AlertCircle className="h-16 w-16 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Error Loading Profile</h2>
        <p className="text-muted-foreground">Please try refreshing the page.</p>
      </motion.div>
    );
  }

  if (!profile) return null;

  const yearsOfService = profile.joinDate 
    ? Math.floor(differenceInDays(new Date(), parseISO(profile.joinDate)) / 365)
    : 0;

  const leaveProgress = leaveBalance 
    ? (leaveBalance.leavesUsed / leaveBalance.totalLeaves) * 100 
    : 0;

  return (
    <motion.div 
      className="space-y-6 p-4 md:p-6"
      {...pageTransition}
    >
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-oak-dark pl-12 md:pl-0">Employee Portal</h1>
          <p className="text-muted-foreground pl-12 md:pl-0">Welcome back, {profile.name}</p>
        </div>
        <div className="flex gap-2">
          {isSuperadmin && (
            <Link href="/hr">
              <Button className="gap-2 bg-[#7C8B5D] hover:bg-[#6a7a4d]" data-testid="button-add-new-employee">
                <Plus className="h-4 w-4" />
                Add New Employee
              </Button>
            </Link>
          )}
          {canViewOtherEmployees && managedEmployees.length > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2" data-testid="button-view-team">
                  <Users className="h-4 w-4" />
                  View Team ({managedEmployees.length})
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {user?.role === 'superadmin' ? 'All Employees' : 'Your Team'}
                  </DialogTitle>
                  <DialogDescription>
                    {user?.role === 'superadmin' 
                      ? 'View any employee portal as superadmin'
                      : 'View portals of employees assigned to you'
                    }
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-2">
                  {managedEmployees.map((emp) => (
                    <div 
                      key={emp.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                      onClick={() => {
                        setSelectedEmployeeId(emp.id);
                      }}
                      data-testid={`employee-card-${emp.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{emp.name}</div>
                          <div className="text-sm text-muted-foreground">{emp.designation}</div>
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-mono text-muted-foreground">{emp.employeeId}</div>
                        <div className="text-muted-foreground">{emp.department || 'No Dept'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>
          )}
          <Button variant="outline" className="gap-2" onClick={() => setIsPasswordDialogOpen(true)} data-testid="button-change-password">
            <Lock className="h-4 w-4" />
            <span className="hidden md:inline">Change Password</span>
          </Button>
        </div>
      </div>

      {/* Password Change Dialog */}
      <Dialog open={isPasswordDialogOpen} onOpenChange={setIsPasswordDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Change Password
            </DialogTitle>
            <DialogDescription>
              Update your account password. You'll need your current password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <div className="relative">
                <Input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  data-testid="input-current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                  data-testid="input-new-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Minimum 8 characters</p>
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                data-testid="input-confirm-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={changePasswordMutation.isPending}
              data-testid="button-submit-password"
            >
              {changePasswordMutation.isPending ? 'Changing...' : 'Change Password'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Viewing Employee Modal */}
      <Dialog open={!!selectedEmployeeId} onOpenChange={(open) => !open && setSelectedEmployeeId(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {viewingLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : viewedEmployeeData ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setSelectedEmployeeId(null)}>
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div>
                    <DialogTitle className="flex items-center gap-2">
                      {viewedEmployeeData.employee.name}
                      <Badge variant="outline">{viewedEmployeeData.employee.employeeId}</Badge>
                    </DialogTitle>
                    <DialogDescription>
                      {viewedEmployeeData.employee.designation} • {viewedEmployeeData.employee.department || 'No Department'}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="grid gap-4">
                {/* Employee Overview */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Card>
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground">Salary</div>
                      <div className="font-semibold">{formatCurrency(viewedEmployeeData.employee.salary)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground">Join Date</div>
                      <div className="font-semibold">{formatDate(viewedEmployeeData.employee.joinDate)}</div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground">Leave Balance</div>
                      <div className="font-semibold">
                        {viewedEmployeeData.leaveBalance?.leavesRemaining || 0} days
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <div className="text-xs text-muted-foreground">Pending Requests</div>
                      <div className="font-semibold">
                        {viewedEmployeeData.leaveRequests.filter(r => r.status === 'pending').length +
                         viewedEmployeeData.salaryAdvances.filter(r => r.status === 'pending').length +
                         viewedEmployeeData.expenses.filter(r => r.status === 'pending').length}
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Contact Info */}
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-sm">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Email:</span> {viewedEmployeeData.employee.email || '-'}</div>
                    <div><span className="text-muted-foreground">Phone:</span> {viewedEmployeeData.employee.phone || '-'}</div>
                    <div className="col-span-2"><span className="text-muted-foreground">Address:</span> {viewedEmployeeData.employee.address}</div>
                    <div className="col-span-2"><span className="text-muted-foreground">Emergency:</span> {viewedEmployeeData.employee.emergencyContact}</div>
                  </CardContent>
                </Card>

                {/* Recent Activity */}
                {(viewedEmployeeData.leaveRequests.length > 0 || viewedEmployeeData.salaryAdvances.length > 0 || viewedEmployeeData.expenses.length > 0) && (
                  <Card>
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm">Recent Requests</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2 space-y-2 max-h-48 overflow-y-auto">
                      {viewedEmployeeData.leaveRequests.slice(0, 5).map(req => (
                        <div key={req.id} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                          <span>Leave: {formatDate(req.startDate)} - {formatDate(req.endDate)}</span>
                          {getStatusBadge(req.status)}
                        </div>
                      ))}
                      {viewedEmployeeData.salaryAdvances.slice(0, 3).map(req => (
                        <div key={req.id} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                          <span>Advance: {formatCurrency(req.amount)}</span>
                          {getStatusBadge(req.status)}
                        </div>
                      ))}
                      {viewedEmployeeData.expenses.slice(0, 3).map(req => (
                        <div key={req.id} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded">
                          <span>Expense: {formatCurrency(req.amount)} - {req.category}</span>
                          {getStatusBadge(req.status)}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Failed to load employee data
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="overview" className="text-xs md:text-sm" data-testid="tab-overview">
            <User className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden md:inline">Overview</span>
          </TabsTrigger>
          <TabsTrigger value="quick-entry" className="text-xs md:text-sm" data-testid="tab-quick-entry">
            <Upload className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden md:inline">Quick Entry</span>
          </TabsTrigger>
          <TabsTrigger value="leaves" className="text-xs md:text-sm" data-testid="tab-leaves">
            <CalendarDays className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden md:inline">Leaves</span>
          </TabsTrigger>
          <TabsTrigger value="expenses" className="text-xs md:text-sm" data-testid="tab-expenses">
            <Receipt className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden md:inline">Expenses</span>
          </TabsTrigger>
          <TabsTrigger value="payroll" className="text-xs md:text-sm" data-testid="tab-payroll">
            <DollarSign className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden md:inline">Payroll</span>
          </TabsTrigger>
          <TabsTrigger value="salary-slips" className="text-xs md:text-sm" data-testid="tab-salary-slips">
            <Receipt className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden md:inline">Salary Slips</span>
          </TabsTrigger>
          <TabsTrigger value="increments" className="text-xs md:text-sm" data-testid="tab-increments">
            <TrendingUp className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden md:inline">Increments</span>
          </TabsTrigger>
          <TabsTrigger value="appraisals" className="text-xs md:text-sm" data-testid="tab-appraisals">
            <Star className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden md:inline">Appraisals</span>
          </TabsTrigger>
          <TabsTrigger value="advances" className="text-xs md:text-sm" data-testid="tab-advances">
            <CreditCard className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden md:inline">Advances</span>
          </TabsTrigger>
          <TabsTrigger value="holidays" className="text-xs md:text-sm" data-testid="tab-holidays">
            <PartyPopper className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden md:inline">Holidays</span>
          </TabsTrigger>
          <TabsTrigger value="duties" className="text-xs md:text-sm" data-testid="tab-duties">
            <ClipboardList className="h-4 w-4 mr-1 md:mr-2" />
            <span className="hidden md:inline">Duties</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <motion.div 
            className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Current Salary</CardTitle>
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-salary">
                    {formatCurrency(profile.salary)}
                  </div>
                  <p className="text-xs text-muted-foreground">per month</p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Years of Service</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-years-service">
                    {yearsOfService}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Since {formatDate(profile.joinDate)}
                  </p>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Leave Balance</CardTitle>
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-leave-balance">
                    {leaveBalance?.leavesRemaining ?? '-'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    of {leaveBalance?.totalLeaves ?? '-'} days remaining
                  </p>
                  <Progress value={leaveProgress} className="mt-2 h-1" />
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Increments</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-total-increments">
                    {increments.length}
                  </div>
                  <p className="text-xs text-muted-foreground">total received</p>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          <motion.div 
            className="grid gap-4 mt-4 md:grid-cols-2"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader>
                  <CardTitle>Profile Information</CardTitle>
                  <CardDescription>Your personal and employment details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 pb-4 border-b">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={profile.photoUrl || undefined} alt={profile.name} />
                      <AvatarFallback className="text-lg bg-primary/10">
                        {profile.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-lg font-semibold">{profile.name}</p>
                      <p className="text-sm text-muted-foreground">{profile.designation}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{profile.designation}</p>
                      <p className="text-xs text-muted-foreground">{profile.department || 'General'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Employee ID</p>
                      <p className="text-xs text-muted-foreground">{profile.employeeId}</p>
                    </div>
                  </div>
                  {profile.email && (
                    <div className="flex items-center gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Email</p>
                        <p className="text-xs text-muted-foreground">{profile.email}</p>
                      </div>
                    </div>
                  )}
                  {profile.phone && (
                    <div className="flex items-center gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">Phone</p>
                        <p className="text-xs text-muted-foreground">{profile.phone}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Address</p>
                      <p className="text-xs text-muted-foreground">{profile.address}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Your latest requests and updates</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {leaveRequests.slice(0, 3).map((request) => (
                      <div key={request.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div>
                          <p className="text-sm font-medium">Leave Request</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(request.startDate)} - {formatDate(request.endDate)}
                          </p>
                        </div>
                        {getStatusBadge(request.status)}
                      </div>
                    ))}
                    {salaryAdvances.slice(0, 2).map((advance) => (
                      <div key={advance.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div>
                          <p className="text-sm font-medium">Salary Advance</p>
                          <p className="text-xs text-muted-foreground">{formatCurrency(advance.amount)}</p>
                        </div>
                        {getStatusBadge(advance.status)}
                      </div>
                    ))}
                    {leaveRequests.length === 0 && salaryAdvances.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No recent activity
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          <motion.div 
            className="mt-4"
            variants={staggerItem}
            initial="initial"
            animate="animate"
          >
            <UserGuides />
          </motion.div>
        </TabsContent>

        <TabsContent value="quick-entry">
          <QuickEntryTab />
        </TabsContent>

        <TabsContent value="leaves">
          <motion.div 
            className="space-y-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Leave Balance - {leaveBalance?.fiscalYear}</CardTitle>
                    <CardDescription>Your annual leave allocation</CardDescription>
                  </div>
                  <Button onClick={() => setIsLeaveDialogOpen(true)} data-testid="button-request-leave">
                    <Plus className="h-4 w-4 mr-2" />
                    Request Leave
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-primary">
                        {leaveBalance?.totalLeaves ?? 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Total Leaves</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-orange-600">
                        {leaveBalance?.leavesUsed ?? 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Used</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-green-600">
                        {leaveBalance?.leavesRemaining ?? 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Remaining</p>
                    </div>
                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                      <p className="text-2xl font-bold text-blue-600">
                        {leaveBalance?.carryForward ?? 0}
                      </p>
                      <p className="text-sm text-muted-foreground">Carry Forward</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader>
                  <CardTitle>Leave History</CardTitle>
                  <CardDescription>Your leave requests and their status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Type</TableHead>
                          <TableHead>From</TableHead>
                          <TableHead>To</TableHead>
                          <TableHead>Days</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {leaveRequests.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                              No leave requests found
                            </TableCell>
                          </TableRow>
                        ) : (
                          leaveRequests.map((request) => {
                            const days = differenceInDays(parseISO(request.endDate), parseISO(request.startDate)) + 1;
                            return (
                              <TableRow key={request.id} data-testid={`row-leave-${request.id}`}>
                                <TableCell className="capitalize">{request.leaveType}</TableCell>
                                <TableCell>{formatDate(request.startDate)}</TableCell>
                                <TableCell>{formatDate(request.endDate)}</TableCell>
                                <TableCell>{days}</TableCell>
                                <TableCell className="max-w-[200px] truncate">{request.reason || '-'}</TableCell>
                                <TableCell>{getStatusBadge(request.status)}</TableCell>
                                <TableCell className="text-right">
                                  {canEditDelete(request.status) && (
                                    <div className="flex justify-end gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => setEditingLeave(request)}
                                        data-testid={`button-edit-leave-${request.id}`}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                        onClick={() => {
                                          if (confirm('Delete this leave request?')) {
                                            deleteLeaveRequest.mutate(request.id);
                                          }
                                        }}
                                        disabled={deleteLeaveRequest.isPending}
                                        data-testid={`button-delete-leave-${request.id}`}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
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
            </motion.div>
          </motion.div>

          {/* Edit Leave Request Dialog */}
          <Dialog open={!!editingLeave} onOpenChange={(open) => !open && setEditingLeave(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Leave Request</DialogTitle>
              </DialogHeader>
              {editingLeave && (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  updateLeaveRequest.mutate({
                    id: editingLeave.id,
                    data: {
                      startDate: formData.get('startDate'),
                      endDate: formData.get('endDate'),
                      leaveType: formData.get('leaveType'),
                      reason: formData.get('reason'),
                    }
                  });
                }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" name="startDate" defaultValue={editingLeave.startDate} required data-testid="input-edit-leave-start" />
                    </div>
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input type="date" name="endDate" defaultValue={editingLeave.endDate} required data-testid="input-edit-leave-end" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Leave Type</Label>
                    <Select name="leaveType" defaultValue={editingLeave.leaveType}>
                      <SelectTrigger data-testid="select-edit-leave-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="casual">Casual Leave</SelectItem>
                        <SelectItem value="sick">Sick Leave</SelectItem>
                        <SelectItem value="annual">Annual Leave</SelectItem>
                        <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Textarea name="reason" defaultValue={editingLeave.reason || ''} data-testid="input-edit-leave-reason" />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setEditingLeave(null)}>Cancel</Button>
                    <Button type="submit" disabled={updateLeaveRequest.isPending} data-testid="button-save-leave">
                      {updateLeaveRequest.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="payroll">
          <motion.div variants={staggerItem} initial="initial" animate="animate">
            <Card>
              <CardHeader>
                <CardTitle>Payroll History</CardTitle>
                <CardDescription>Your salary payments and details</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Month</TableHead>
                        <TableHead>Gross Pay</TableHead>
                        <TableHead>Deductions</TableHead>
                        <TableHead>Net Pay</TableHead>
                        <TableHead>Days Worked</TableHead>
                        <TableHead>Pay Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No payroll history found
                          </TableCell>
                        </TableRow>
                      ) : (
                        payrollHistory.map((item) => (
                          <TableRow key={item.id} data-testid={`row-payroll-${item.id}`}>
                            <TableCell>{getMonthName(item.month)} {item.year}</TableCell>
                            <TableCell>{formatCurrency(item.grossPay)}</TableCell>
                            <TableCell className="text-red-600">-{formatCurrency(item.deductions)}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(item.netPay)}</TableCell>
                            <TableCell>{item.daysWorked}</TableCell>
                            <TableCell>{formatDate(item.payDate)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="salary-slips">
          <EmployeeSalarySlipsSection employeeId={profile.id} />
        </TabsContent>

        <TabsContent value="increments">
          <motion.div variants={staggerItem} initial="initial" animate="animate">
            <Card>
              <CardHeader>
                <CardTitle>Salary Increments</CardTitle>
                <CardDescription>Your salary growth over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Effective Date</TableHead>
                        <TableHead>Previous Salary</TableHead>
                        <TableHead>New Salary</TableHead>
                        <TableHead>Increment</TableHead>
                        <TableHead>Percentage</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {increments.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No increment records found
                          </TableCell>
                        </TableRow>
                      ) : (
                        increments.map((increment) => (
                          <TableRow key={increment.id} data-testid={`row-increment-${increment.id}`}>
                            <TableCell>{formatDate(increment.effectiveDate)}</TableCell>
                            <TableCell>{formatCurrency(increment.previousSalary)}</TableCell>
                            <TableCell className="font-medium text-green-600">
                              {formatCurrency(increment.newSalary)}
                            </TableCell>
                            <TableCell className="text-green-600">
                              +{formatCurrency(increment.incrementAmount)}
                            </TableCell>
                            <TableCell>
                              {increment.incrementPercent ? `${increment.incrementPercent}%` : '-'}
                            </TableCell>
                            <TableCell className="capitalize">{increment.reason || '-'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </TabsContent>

        <TabsContent value="appraisals">
          <motion.div 
            className="grid gap-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            {appraisals.length === 0 ? (
              <motion.div variants={staggerItem}>
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    No appraisal records found
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              appraisals.map((appraisal) => (
                <motion.div key={appraisal.id} variants={staggerItem}>
                  <Card data-testid={`card-appraisal-${appraisal.id}`}>
                    <CardHeader className="flex flex-row items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          Performance Review
                          {getStatusBadge(appraisal.status)}
                        </CardTitle>
                        <CardDescription>
                          {formatDate(appraisal.reviewPeriodStart)} - {formatDate(appraisal.reviewPeriodEnd)}
                        </CardDescription>
                      </div>
                      <div className="text-right">
                        {getRatingStars(appraisal.rating)}
                        {appraisal.ratingLabel && (
                          <p className="text-sm text-muted-foreground mt-1">{appraisal.ratingLabel}</p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {appraisal.strengths && (
                        <div>
                          <h4 className="text-sm font-medium text-green-600 mb-1">Strengths</h4>
                          <p className="text-sm text-muted-foreground">{appraisal.strengths}</p>
                        </div>
                      )}
                      {appraisal.areasOfImprovement && (
                        <div>
                          <h4 className="text-sm font-medium text-orange-600 mb-1">Areas of Improvement</h4>
                          <p className="text-sm text-muted-foreground">{appraisal.areasOfImprovement}</p>
                        </div>
                      )}
                      {appraisal.goals && (
                        <div>
                          <h4 className="text-sm font-medium text-blue-600 mb-1">Goals</h4>
                          <p className="text-sm text-muted-foreground">{appraisal.goals}</p>
                        </div>
                      )}
                      {appraisal.managerComments && (
                        <div>
                          <h4 className="text-sm font-medium mb-1">Manager Comments</h4>
                          <p className="text-sm text-muted-foreground">{appraisal.managerComments}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              ))
            )}
          </motion.div>
        </TabsContent>

        <TabsContent value="advances">
          <motion.div 
            className="space-y-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Salary Advance Requests</CardTitle>
                    <CardDescription>Request and track salary advances</CardDescription>
                  </div>
                  <Button onClick={() => setIsAdvanceDialogOpen(true)} data-testid="button-request-advance">
                    <Plus className="h-4 w-4 mr-2" />
                    Request Advance
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Request Date</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Reason</TableHead>
                          <TableHead>Repayment Months</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Approved Amount</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salaryAdvances.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                              No salary advance requests found
                            </TableCell>
                          </TableRow>
                        ) : (
                          salaryAdvances.map((advance) => (
                            <TableRow key={advance.id} data-testid={`row-advance-${advance.id}`}>
                              <TableCell>{formatDate(advance.requestDate)}</TableCell>
                              <TableCell>{formatCurrency(advance.amount)}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{advance.reason || '-'}</TableCell>
                              <TableCell>{advance.repaymentMonths}</TableCell>
                              <TableCell>{getStatusBadge(advance.status)}</TableCell>
                              <TableCell>
                                {advance.approvedAmount ? formatCurrency(advance.approvedAmount) : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                {canEditDelete(advance.status) && (
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setEditingAdvance(advance)}
                                      data-testid={`button-edit-advance-${advance.id}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={() => {
                                        if (confirm('Delete this salary advance request?')) {
                                          deleteSalaryAdvance.mutate(advance.id);
                                        }
                                      }}
                                      disabled={deleteSalaryAdvance.isPending}
                                      data-testid={`button-delete-advance-${advance.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Edit Salary Advance Dialog */}
          <Dialog open={!!editingAdvance} onOpenChange={(open) => !open && setEditingAdvance(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Salary Advance Request</DialogTitle>
              </DialogHeader>
              {editingAdvance && (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  updateSalaryAdvance.mutate({
                    id: editingAdvance.id,
                    data: {
                      amount: formData.get('amount'),
                      reason: formData.get('reason'),
                      repaymentMonths: parseInt(formData.get('repaymentMonths') as string),
                    }
                  });
                }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input type="number" name="amount" defaultValue={editingAdvance.amount} required data-testid="input-edit-advance-amount" />
                  </div>
                  <div className="space-y-2">
                    <Label>Repayment Months</Label>
                    <Select name="repaymentMonths" defaultValue={String(editingAdvance.repaymentMonths)}>
                      <SelectTrigger data-testid="select-edit-advance-months">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1,2,3,4,5,6,9,12].map(m => (
                          <SelectItem key={m} value={String(m)}>{m} month{m > 1 ? 's' : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Reason</Label>
                    <Textarea name="reason" defaultValue={editingAdvance.reason || ''} data-testid="input-edit-advance-reason" />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setEditingAdvance(null)}>Cancel</Button>
                    <Button type="submit" disabled={updateSalaryAdvance.isPending} data-testid="button-save-advance">
                      {updateSalaryAdvance.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="expenses">
          <motion.div 
            className="space-y-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      Expense Reimbursements
                    </CardTitle>
                    <CardDescription>Track your expense reimbursement requests</CardDescription>
                  </div>
                  <Button onClick={() => setIsExpenseDialogOpen(true)} data-testid="button-new-expense">
                    <Plus className="h-4 w-4 mr-2" />
                    New Request
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Expense Date</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Comments</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenseReimbursements.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                              No expense reimbursement requests found
                            </TableCell>
                          </TableRow>
                        ) : (
                          expenseReimbursements.map((expense) => (
                            <TableRow key={expense.id} data-testid={`row-expense-${expense.id}`}>
                              <TableCell>{formatDate(expense.expenseDate)}</TableCell>
                              <TableCell className="capitalize">{expense.category}</TableCell>
                              <TableCell className="max-w-[200px] truncate">{expense.description}</TableCell>
                              <TableCell>{formatCurrency(expense.amount)}</TableCell>
                              <TableCell>{getStatusBadge(expense.status)}</TableCell>
                              <TableCell className="max-w-[150px] truncate">{expense.managerComments || '-'}</TableCell>
                              <TableCell className="text-right">
                                {canEditDelete(expense.status) && (
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => setEditingExpense(expense)}
                                      data-testid={`button-edit-expense-${expense.id}`}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive"
                                      onClick={() => {
                                        if (confirm('Delete this expense request?')) {
                                          deleteExpenseReimbursement.mutate(expense.id);
                                        }
                                      }}
                                      disabled={deleteExpenseReimbursement.isPending}
                                      data-testid={`button-delete-expense-${expense.id}`}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Edit Expense Reimbursement Dialog */}
          <Dialog open={!!editingExpense} onOpenChange={(open) => !open && setEditingExpense(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Edit Expense Reimbursement</DialogTitle>
              </DialogHeader>
              {editingExpense && (
                <form onSubmit={(e) => {
                  e.preventDefault();
                  const formData = new FormData(e.currentTarget);
                  updateExpenseReimbursement.mutate({
                    id: editingExpense.id,
                    data: {
                      expenseDate: formData.get('expenseDate'),
                      category: formData.get('category'),
                      description: formData.get('description'),
                      amount: formData.get('amount'),
                    }
                  });
                }} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Expense Date</Label>
                    <Input type="date" name="expenseDate" defaultValue={editingExpense.expenseDate} required data-testid="input-edit-expense-date" />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select name="category" defaultValue={editingExpense.category}>
                      <SelectTrigger data-testid="select-edit-expense-category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="travel">Travel</SelectItem>
                        <SelectItem value="meals">Meals</SelectItem>
                        <SelectItem value="supplies">Office Supplies</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="communication">Communication</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea name="description" defaultValue={editingExpense.description} required data-testid="input-edit-expense-description" />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input type="number" name="amount" defaultValue={editingExpense.amount} required data-testid="input-edit-expense-amount" />
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setEditingExpense(null)}>Cancel</Button>
                    <Button type="submit" disabled={updateExpenseReimbursement.isPending} data-testid="button-save-expense">
                      {updateExpenseReimbursement.isPending ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </DialogFooter>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="holidays">
          <motion.div 
            className="space-y-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PartyPopper className="h-5 w-5" />
                    Public Holidays {new Date().getFullYear()}
                  </CardTitle>
                  <CardDescription>Upcoming holidays for the current year</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Holiday</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Type</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {publicHolidays.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                              No public holidays found for this year
                            </TableCell>
                          </TableRow>
                        ) : (
                          publicHolidays.map((holiday) => (
                            <TableRow key={holiday.id} data-testid={`row-holiday-${holiday.id}`}>
                              <TableCell>{formatDate(holiday.date)}</TableCell>
                              <TableCell className="font-medium">{holiday.name}</TableCell>
                              <TableCell>{holiday.description || '-'}</TableCell>
                              <TableCell>
                                <Badge variant={holiday.isNational ? 'default' : 'secondary'}>
                                  {holiday.isNational ? 'National' : 'Regional'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </TabsContent>

        <TabsContent value="duties">
          <motion.div 
            className="space-y-4"
            variants={staggerContainer}
            initial="initial"
            animate="animate"
          >
            <motion.div variants={staggerItem}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="h-5 w-5" />
                    My Duties & Responsibilities
                  </CardTitle>
                  <CardDescription>Your assigned duties and responsibilities</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="h-4 w-4 text-oak-dark" />
                        <span className="font-medium">Designation</span>
                      </div>
                      <p className="text-lg">{employeeDuties?.designation || profile.designation}</p>
                    </div>
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="h-4 w-4 text-oak-dark" />
                        <span className="font-medium">Department</span>
                      </div>
                      <p className="text-lg">{employeeDuties?.department || profile.department || '-'}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-lg mb-3 flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        Duties
                      </h4>
                      <div className="p-4 bg-muted/30 rounded-lg border">
                        {employeeDuties?.duties ? (
                          <p className="whitespace-pre-wrap text-muted-foreground">{employeeDuties.duties}</p>
                        ) : (
                          <p className="text-muted-foreground italic">No duties assigned yet. Contact your manager for more information.</p>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-lg mb-3 flex items-center gap-2">
                        <ClipboardList className="h-5 w-5 text-blue-600" />
                        Responsibilities
                      </h4>
                      <div className="p-4 bg-muted/30 rounded-lg border">
                        {employeeDuties?.responsibilities ? (
                          <p className="whitespace-pre-wrap text-muted-foreground">{employeeDuties.responsibilities}</p>
                        ) : (
                          <p className="text-muted-foreground italic">No responsibilities assigned yet. Contact your manager for more information.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>
        </TabsContent>
      </Tabs>

      <LeaveRequestDialog 
        open={isLeaveDialogOpen} 
        onOpenChange={setIsLeaveDialogOpen}
        onSubmit={(data) => submitLeaveRequest.mutate(data)}
        isLoading={submitLeaveRequest.isPending}
        leaveCategories={leaveCategories}
      />

      <AdvanceRequestDialog 
        open={isAdvanceDialogOpen} 
        onOpenChange={setIsAdvanceDialogOpen}
        onSubmit={(data) => submitAdvanceRequest.mutate(data)}
        isLoading={submitAdvanceRequest.isPending}
      />

      <ExpenseReimbursementDialog 
        open={isExpenseDialogOpen} 
        onOpenChange={setIsExpenseDialogOpen}
        onSubmit={(data) => submitExpenseReimbursement.mutate(data)}
        isLoading={submitExpenseReimbursement.isPending}
      />
    </motion.div>
  );
}

function LeaveRequestDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isLoading,
  leaveCategories 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { startDate: string; endDate: string; leaveType: string; categoryId: string; reason: string }) => void;
  isLoading: boolean;
  leaveCategories: LeaveCategory[];
}) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [reason, setReason] = useState('');

  const selectedCategory = leaveCategories.find(c => c.id === selectedCategoryId);
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId || !selectedCategory) return;
    onSubmit({ startDate, endDate, leaveType: selectedCategory.name.toLowerCase(), categoryId: selectedCategoryId, reason });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Leave</DialogTitle>
          <DialogDescription>Submit a new leave request for approval</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                data-testid="input-leave-start"
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                data-testid="input-leave-end"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Leave Type</Label>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger data-testid="select-leave-type">
                <SelectValue placeholder="Select leave type" />
              </SelectTrigger>
              <SelectContent>
                {leaveCategories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name} ({category.defaultAnnualAllowance} days/year)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for leave..."
              data-testid="input-leave-reason"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} data-testid="button-submit-leave">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdvanceRequestDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isLoading 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { amount: string; reason: string; repaymentMonths: number }) => void;
  isLoading: boolean;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [repaymentMonths, setRepaymentMonths] = useState('1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ amount, reason, repaymentMonths: parseInt(repaymentMonths) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Salary Advance</DialogTitle>
          <DialogDescription>Submit a request for salary advance</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Amount (₹)</Label>
            <Input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              required
              data-testid="input-advance-amount"
            />
          </div>
          <div className="space-y-2">
            <Label>Repayment Period (Months)</Label>
            <Select value={repaymentMonths} onValueChange={setRepaymentMonths}>
              <SelectTrigger data-testid="select-repayment-months">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5, 6].map((m) => (
                  <SelectItem key={m} value={m.toString()}>{m} Month{m > 1 ? 's' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Textarea 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason for advance..."
              data-testid="input-advance-reason"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} data-testid="button-submit-advance">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseReimbursementDialog({ 
  open, 
  onOpenChange, 
  onSubmit, 
  isLoading 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { expenseDate: string; category: string; description: string; amount: string }) => void;
  isLoading: boolean;
}) {
  const [expenseDate, setExpenseDate] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ expenseDate, category, description, amount });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request Expense Reimbursement</DialogTitle>
          <DialogDescription>Submit a request for expense reimbursement</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Expense Date</Label>
              <Input 
                type="date" 
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                required
                data-testid="input-expense-date"
              />
            </div>
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input 
                type="number" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Enter amount"
                required
                data-testid="input-expense-amount"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger data-testid="select-expense-category">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="travel">Travel</SelectItem>
                <SelectItem value="food">Food & Meals</SelectItem>
                <SelectItem value="accommodation">Accommodation</SelectItem>
                <SelectItem value="supplies">Office Supplies</SelectItem>
                <SelectItem value="communication">Communication</SelectItem>
                <SelectItem value="transport">Local Transport</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the expense..."
              required
              data-testid="input-expense-description"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !category} data-testid="button-submit-expense">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

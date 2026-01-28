import { useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Search, Download, Users, CheckCircle2, XCircle, HelpCircle, Trash2, Filter, 
  ArrowUpDown, ArrowUp, ArrowDown, Upload, FileSpreadsheet, Settings2, 
  ChevronDown, AlertCircle, Loader2, Crown, Lock
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface RsvpSubmission {
  id: string;
  eventId: string;
  templateId: string;
  companyId: string;
  guestId?: string | null;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  attending: string;
  partySize: number;
  responses?: Record<string, unknown> | null;
  source: string;
  ipAddress?: string | null;
  submittedAt: string;
  updatedAt: string;
}

interface Event {
  id: string;
  title: string;
  date: string;
}

interface RsvpStats {
  total: number;
  attending: number;
  notAttending: number;
  maybe: number;
  pending: number;
}

interface RsvpFormField {
  id: string;
  templateId: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  required: boolean;
}

interface RsvpFormTemplate {
  id: string;
  eventId?: string | null;
  name: string;
}

type SortField = 'guestName' | 'guestEmail' | 'attending' | 'partySize' | 'source' | 'submittedAt';
type SortDirection = 'asc' | 'desc';

interface ColumnVisibility {
  name: boolean;
  email: boolean;
  phone: boolean;
  status: boolean;
  guests: boolean;
  source: boolean;
  submitted: boolean;
  customFields: boolean;
}

interface ImportPreviewRow {
  rowNum: number;
  data: Record<string, string>;
  errors: string[];
}

interface KnotVitePlanStatus {
  plan: 'free' | 'pro';
  limits: {
    maxForms: number;
    maxGuestsPerForm: number;
    maxCustomFields: number;
    canExportExcel: boolean;
    canBulkImport: boolean;
    canRemoveBranding: boolean;
    canUseWhatsApp: boolean;
  };
  usage: {
    formsCount: number;
    totalGuests: number;
  };
}

const DEFAULT_COLUMNS: ColumnVisibility = {
  name: true,
  email: true,
  phone: true,
  status: true,
  guests: true,
  source: true,
  submitted: true,
  customFields: false,
};

export default function KnotViteSubmissions() {
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [attendingFilter, setAttendingFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>('submittedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibility>(DEFAULT_COLUMNS);
  
  // Bulk import state
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'preview' | 'importing'>('upload');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<Record<string, string>[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([]);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  // Get KnotVite plan status for feature gating
  const { data: planStatus } = useQuery<KnotVitePlanStatus>({
    queryKey: ['/api/knotvite/plan-status'],
    queryFn: async () => {
      const res = await fetch('/api/knotvite/plan-status', { credentials: 'include' });
      if (!res.ok) return { plan: 'free', limits: { maxForms: 1, maxGuestsPerForm: 100, maxCustomFields: 5, canExportExcel: false, canBulkImport: false, canRemoveBranding: false, canUseWhatsApp: false }, usage: { formsCount: 0, totalGuests: 0 } };
      return res.json();
    },
  });

  const isPro = planStatus?.plan === 'pro';

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await fetch('/api/events', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch events');
      return res.json();
    },
  });

  // Get templates to find the one for selected event
  const { data: templates = [] } = useQuery<RsvpFormTemplate[]>({
    queryKey: ['/api/rsvp/templates'],
    queryFn: async () => {
      const res = await fetch('/api/rsvp/templates', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch templates');
      return res.json();
    },
  });

  const selectedTemplate = useMemo(() => {
    return templates.find(t => t.eventId === selectedEventId);
  }, [templates, selectedEventId]);

  // Get form fields for the selected template
  const { data: formFields = [] } = useQuery<RsvpFormField[]>({
    queryKey: ['/api/rsvp/templates', selectedTemplate?.id, 'fields'],
    queryFn: async () => {
      if (!selectedTemplate?.id) return [];
      const res = await fetch(`/api/rsvp/templates/${selectedTemplate.id}/fields`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch fields');
      return res.json();
    },
    enabled: !!selectedTemplate?.id,
  });

  const { data: submissions = [] } = useQuery<RsvpSubmission[]>({
    queryKey: ['/api/rsvp/events', selectedEventId, 'submissions'],
    queryFn: async () => {
      if (!selectedEventId) return [];
      const res = await fetch(`/api/rsvp/events/${selectedEventId}/submissions`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch submissions');
      return res.json();
    },
    enabled: !!selectedEventId,
  });

  const { data: stats } = useQuery<RsvpStats>({
    queryKey: ['/api/rsvp/events', selectedEventId, 'stats'],
    queryFn: async () => {
      if (!selectedEventId) return { total: 0, attending: 0, notAttending: 0, maybe: 0, pending: 0 };
      const res = await fetch(`/api/rsvp/events/${selectedEventId}/stats`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled: !!selectedEventId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/rsvp/submissions/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp/events', selectedEventId, 'submissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp/events', selectedEventId, 'stats'] });
      toast({ title: "Deleted", description: "Submission removed" });
    },
  });

  const bulkImportMutation = useMutation({
    mutationFn: async (data: { eventId: string; guests: Record<string, any>[] }) => {
      const res = await fetch('/api/rsvp/bulk-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Import failed');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp/events', selectedEventId, 'submissions'] });
      queryClient.invalidateQueries({ queryKey: ['/api/rsvp/events', selectedEventId, 'stats'] });
      toast({ title: "Import Complete", description: `${data.successCount} guests imported successfully` });
      resetImportState();
    },
    onError: (error: Error) => {
      toast({ title: "Import Failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="h-4 w-4 ml-1" /> : 
      <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const filteredAndSortedSubmissions = useMemo(() => {
    let result = submissions.filter(s => {
      const matchesSearch = !searchTerm || 
        s.guestName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.guestEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.guestPhone?.includes(searchTerm);
      const matchesFilter = attendingFilter === 'all' || s.attending === attendingFilter;
      return matchesSearch && matchesFilter;
    });

    result.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      if (sortField === 'submittedAt') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = (bVal || '').toLowerCase();
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [submissions, searchTerm, attendingFilter, sortField, sortDirection]);

  const totalGuests = useMemo(() => {
    return submissions
      .filter(s => s.attending === 'yes')
      .reduce((sum, s) => sum + (s.partySize || 1), 0);
  }, [submissions]);

  const exportToCsv = () => {
    if (!filteredAndSortedSubmissions.length) return;
    
    const headers = ['Name', 'Email', 'Phone', 'Attending', 'Guests', 'Source', 'Submitted'];
    const rows = filteredAndSortedSubmissions.map(s => [
      s.guestName,
      s.guestEmail || '',
      s.guestPhone || '',
      s.attending,
      String(s.partySize || 1),
      s.source,
      format(new Date(s.submittedAt), 'yyyy-MM-dd HH:mm'),
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rsvp-submissions-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Exported", description: "CSV downloaded successfully" });
  };

  const exportToExcel = () => {
    if (!filteredAndSortedSubmissions.length) return;
    
    const data = filteredAndSortedSubmissions.map(s => {
      const row: Record<string, any> = {
        'Name': s.guestName,
        'Email': s.guestEmail || '',
        'Phone': s.guestPhone || '',
        'Attending': s.attending === 'yes' ? 'Yes' : s.attending === 'no' ? 'No' : s.attending === 'maybe' ? 'Maybe' : 'Pending',
        'Party Size': s.partySize || 1,
        'Source': s.source,
        'Submitted': format(new Date(s.submittedAt), 'yyyy-MM-dd HH:mm'),
      };
      
      // Add custom field responses
      if (s.responses && columnVisibility.customFields) {
        formFields.forEach(field => {
          const value = s.responses?.[field.fieldKey];
          row[field.label] = value !== undefined ? String(value) : '';
        });
      }
      
      return row;
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'RSVP Submissions');
    
    // Auto-size columns
    const colWidths = Object.keys(data[0] || {}).map(key => ({
      wch: Math.max(key.length, ...data.map(row => String(row[key] || '').length)) + 2
    }));
    ws['!cols'] = colWidths;
    
    XLSX.writeFile(wb, `rsvp-submissions-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast({ title: "Exported", description: "Excel file downloaded successfully" });
  };

  // Bulk Import Functions
  const resetImportState = () => {
    setShowImportDialog(false);
    setImportStep('upload');
    setImportFile(null);
    setParsedData([]);
    setCsvColumns([]);
    setColumnMapping({});
    setImportPreview([]);
    setImportProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const isCSV = file.name.endsWith('.csv');
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    
    if (!isCSV && !isExcel) {
      toast({ title: "Invalid File", description: "Please upload a CSV or Excel file", variant: "destructive" });
      return;
    }
    
    setImportFile(file);
    
    if (isCSV) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length === 0) {
            toast({ title: "Empty File", description: "The file contains no data", variant: "destructive" });
            return;
          }
          setParsedData(results.data as Record<string, string>[]);
          setCsvColumns(results.meta.fields || []);
          setImportStep('mapping');
        },
        error: (error) => {
          toast({ title: "Parse Error", description: error.message, variant: "destructive" });
        },
      });
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, { raw: false });
          
          if (jsonData.length === 0) {
            toast({ title: "Empty File", description: "The file contains no data", variant: "destructive" });
            return;
          }
          
          setParsedData(jsonData);
          setCsvColumns(Object.keys(jsonData[0] || {}));
          setImportStep('mapping');
        } catch (error: any) {
          toast({ title: "Parse Error", description: error.message, variant: "destructive" });
        }
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const systemFields = [
    { key: 'guestName', label: 'Guest Name', required: true },
    { key: 'guestEmail', label: 'Email', required: false },
    { key: 'guestPhone', label: 'Phone', required: false },
    { key: 'attending', label: 'Attendance Status', required: false },
    { key: 'partySize', label: 'Party Size', required: false },
  ];

  const handleMappingChange = (systemField: string, csvColumn: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [systemField]: csvColumn === 'none' ? '' : csvColumn,
    }));
  };

  const validateAndPreview = () => {
    if (!columnMapping.guestName) {
      toast({ title: "Mapping Required", description: "Guest Name field is required", variant: "destructive" });
      return;
    }

    const preview: ImportPreviewRow[] = parsedData.slice(0, 10).map((row, index) => {
      const errors: string[] = [];
      const mappedData: Record<string, string> = {};
      
      Object.entries(columnMapping).forEach(([systemField, csvColumn]) => {
        if (csvColumn) {
          mappedData[systemField] = row[csvColumn] || '';
        }
      });
      
      if (!mappedData.guestName?.trim()) {
        errors.push('Guest Name is required');
      }
      
      if (mappedData.guestEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mappedData.guestEmail)) {
        errors.push('Invalid email format');
      }
      
      if (mappedData.partySize && isNaN(parseInt(mappedData.partySize))) {
        errors.push('Party size must be a number');
      }
      
      return { rowNum: index + 1, data: mappedData, errors };
    });
    
    setImportPreview(preview);
    setImportStep('preview');
  };

  const executeImport = async () => {
    setImportStep('importing');
    
    const guests = parsedData.map(row => {
      const guest: Record<string, any> = {
        guestName: row[columnMapping.guestName] || 'Unknown',
        guestEmail: columnMapping.guestEmail ? row[columnMapping.guestEmail] : null,
        guestPhone: columnMapping.guestPhone ? row[columnMapping.guestPhone] : null,
        attending: columnMapping.attending ? normalizeAttending(row[columnMapping.attending]) : 'pending',
        partySize: columnMapping.partySize ? parseInt(row[columnMapping.partySize]) || 1 : 1,
      };
      return guest;
    }).filter(g => g.guestName && g.guestName !== 'Unknown');
    
    bulkImportMutation.mutate({ eventId: selectedEventId, guests });
  };

  const normalizeAttending = (value: string): string => {
    const v = (value || '').toLowerCase().trim();
    if (['yes', 'y', 'attending', 'confirmed', 'true', '1'].includes(v)) return 'yes';
    if (['no', 'n', 'not attending', 'declined', 'false', '0'].includes(v)) return 'no';
    if (['maybe', 'm', 'tentative', 'unsure'].includes(v)) return 'maybe';
    return 'pending';
  };

  const getAttendingBadge = (attending: string) => {
    switch (attending) {
      case 'yes':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100"><CheckCircle2 className="h-3 w-3 mr-1" />Yes</Badge>;
      case 'no':
        return <Badge className="bg-red-100 text-red-700 hover:bg-red-100"><XCircle className="h-3 w-3 mr-1" />No</Badge>;
      case 'maybe':
        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100"><HelpCircle className="h-3 w-3 mr-1" />Maybe</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="submissions-title">RSVP Submissions</h1>
          <p className="text-muted-foreground text-sm">View and manage guest responses</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-[250px]" data-testid="event-filter-select">
              <SelectValue placeholder="Select an event" />
            </SelectTrigger>
            <SelectContent>
              {events.map(event => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedEventId ? (
        <Card className="flex-1">
          <CardContent className="flex flex-col items-center justify-center h-64 text-center">
            <Users className="h-16 w-16 text-muted-foreground/40 mb-4" />
            <h3 className="text-lg font-medium mb-2" data-testid="no-event-selected">Select an Event</h3>
            <p className="text-muted-foreground text-sm">Choose an event to view its RSVP submissions</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            <Card data-testid="stat-total">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold">{stats?.total || 0}</div>
                <p className="text-xs text-muted-foreground">Total Responses</p>
              </CardContent>
            </Card>
            <Card data-testid="stat-attending">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-green-600">{stats?.attending || 0}</div>
                <p className="text-xs text-muted-foreground">Attending ({totalGuests} guests)</p>
              </CardContent>
            </Card>
            <Card data-testid="stat-not-attending">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-red-600">{stats?.notAttending || 0}</div>
                <p className="text-xs text-muted-foreground">Not Attending</p>
              </CardContent>
            </Card>
            <Card data-testid="stat-maybe">
              <CardContent className="pt-4">
                <div className="text-2xl font-bold text-yellow-600">{stats?.maybe || 0}</div>
                <p className="text-xs text-muted-foreground">Maybe</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                data-testid="search-submissions-input"
              />
            </div>
            <Select value={attendingFilter} onValueChange={setAttendingFilter}>
              <SelectTrigger className="w-[150px]" data-testid="attending-filter-select">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Responses</SelectItem>
                <SelectItem value="yes">Attending</SelectItem>
                <SelectItem value="no">Not Attending</SelectItem>
                <SelectItem value="maybe">Maybe</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Column Visibility Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" data-testid="column-settings-btn">
                  <Settings2 className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Visible Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(columnVisibility).map(([key, value]) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={value}
                    onCheckedChange={(checked) => setColumnVisibility(prev => ({ ...prev, [key]: checked }))}
                  >
                    {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            
            {/* Import Button - Pro Feature */}
            <Button 
              variant="outline" 
              onClick={() => {
                if (!isPro && !planStatus?.limits.canBulkImport) {
                  toast({ 
                    title: "Pro Feature", 
                    description: "Bulk import requires a Pro subscription. Upgrade to unlock.", 
                    variant: "default" 
                  });
                  return;
                }
                setShowImportDialog(true);
              }} 
              data-testid="import-btn"
              className={!isPro ? "opacity-75" : ""}
            >
              <Upload className="h-4 w-4 mr-2" />
              Import
              {!isPro && <Crown className="h-3 w-3 ml-1 text-yellow-500" />}
            </Button>
            
            {/* Export Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={!filteredAndSortedSubmissions.length} data-testid="export-dropdown-btn">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuCheckboxItem onClick={exportToCsv}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as CSV
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem 
                  onClick={() => {
                    if (!isPro && !planStatus?.limits.canExportExcel) {
                      toast({ 
                        title: "Pro Feature", 
                        description: "Excel export requires a Pro subscription. Upgrade to unlock.", 
                        variant: "default" 
                      });
                      return;
                    }
                    exportToExcel();
                  }}
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export as Excel
                  {!isPro && <Crown className="h-3 w-3 ml-1 text-yellow-500" />}
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {filteredAndSortedSubmissions.length === 0 ? (
            <Card className="flex-1">
              <CardContent className="flex flex-col items-center justify-center h-48 text-center">
                <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <p className="text-muted-foreground" data-testid="no-submissions">
                  {submissions.length === 0 ? "No responses yet" : "No matching submissions"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table data-testid="submissions-table">
                    <TableHeader>
                      <TableRow>
                        {columnVisibility.name && (
                          <TableHead className="cursor-pointer select-none" onClick={() => handleSort('guestName')}>
                            <div className="flex items-center">Name {getSortIcon('guestName')}</div>
                          </TableHead>
                        )}
                        {columnVisibility.email && (
                          <TableHead className="hidden sm:table-cell cursor-pointer select-none" onClick={() => handleSort('guestEmail')}>
                            <div className="flex items-center">Email {getSortIcon('guestEmail')}</div>
                          </TableHead>
                        )}
                        {columnVisibility.phone && (
                          <TableHead className="hidden md:table-cell">Phone</TableHead>
                        )}
                        {columnVisibility.status && (
                          <TableHead className="cursor-pointer select-none" onClick={() => handleSort('attending')}>
                            <div className="flex items-center">Status {getSortIcon('attending')}</div>
                          </TableHead>
                        )}
                        {columnVisibility.guests && (
                          <TableHead className="hidden md:table-cell cursor-pointer select-none" onClick={() => handleSort('partySize')}>
                            <div className="flex items-center">Guests {getSortIcon('partySize')}</div>
                          </TableHead>
                        )}
                        {columnVisibility.source && (
                          <TableHead className="hidden lg:table-cell cursor-pointer select-none" onClick={() => handleSort('source')}>
                            <div className="flex items-center">Source {getSortIcon('source')}</div>
                          </TableHead>
                        )}
                        {columnVisibility.submitted && (
                          <TableHead className="hidden md:table-cell cursor-pointer select-none" onClick={() => handleSort('submittedAt')}>
                            <div className="flex items-center">Submitted {getSortIcon('submittedAt')}</div>
                          </TableHead>
                        )}
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAndSortedSubmissions.map((sub, index) => (
                        <TableRow key={sub.id} data-testid={`submission-row-${index}`}>
                          {columnVisibility.name && (
                            <TableCell>
                              <div className="font-medium">{sub.guestName}</div>
                            </TableCell>
                          )}
                          {columnVisibility.email && (
                            <TableCell className="hidden sm:table-cell">
                              <div className="text-sm">{sub.guestEmail || '-'}</div>
                            </TableCell>
                          )}
                          {columnVisibility.phone && (
                            <TableCell className="hidden md:table-cell">
                              <div className="text-sm">{sub.guestPhone || '-'}</div>
                            </TableCell>
                          )}
                          {columnVisibility.status && (
                            <TableCell>{getAttendingBadge(sub.attending)}</TableCell>
                          )}
                          {columnVisibility.guests && (
                            <TableCell className="hidden md:table-cell">{sub.partySize || 1}</TableCell>
                          )}
                          {columnVisibility.source && (
                            <TableCell className="hidden lg:table-cell">
                              <Badge variant="outline" className="text-xs">{sub.source}</Badge>
                            </TableCell>
                          )}
                          {columnVisibility.submitted && (
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {format(new Date(sub.submittedAt), 'MMM d, h:mm a')}
                            </TableCell>
                          )}
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                if (confirm('Delete this submission?')) {
                                  deleteMutation.mutate(sub.id);
                                }
                              }}
                              data-testid={`delete-submission-${index}`}
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
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
        </>
      )}

      {/* Bulk Import Dialog */}
      <Dialog open={showImportDialog} onOpenChange={(open) => !open && resetImportState()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {importStep === 'upload' && 'Import Guest List'}
              {importStep === 'mapping' && 'Map Columns'}
              {importStep === 'preview' && 'Preview Import'}
              {importStep === 'importing' && 'Importing...'}
            </DialogTitle>
            <DialogDescription>
              {importStep === 'upload' && 'Upload a CSV or Excel file containing your guest list'}
              {importStep === 'mapping' && 'Match your file columns to guest fields'}
              {importStep === 'preview' && 'Review the data before importing'}
              {importStep === 'importing' && 'Please wait while we import your guests'}
            </DialogDescription>
          </DialogHeader>

          {importStep === 'upload' && (
            <div className="space-y-4">
              <div 
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">Click to upload or drag and drop</p>
                <p className="text-sm text-muted-foreground">CSV or Excel file (max 5MB)</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              {importFile && (
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <FileSpreadsheet className="h-5 w-5" />
                  <span className="flex-1">{importFile.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => setImportFile(null)}>Remove</Button>
                </div>
              )}
            </div>
          )}

          {importStep === 'mapping' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Found {parsedData.length} rows in your file. Map the columns below:
              </p>
              <div className="space-y-3">
                {systemFields.map(field => (
                  <div key={field.key} className="flex items-center gap-4">
                    <Label className="w-32 text-right">
                      {field.label}
                      {field.required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <Select 
                      value={columnMapping[field.key] || 'none'} 
                      onValueChange={(v) => handleMappingChange(field.key, v)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">-- Skip --</SelectItem>
                        {csvColumns.map(col => (
                          <SelectItem key={col} value={col}>{col}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportStep('upload')}>Back</Button>
                <Button onClick={validateAndPreview}>Preview</Button>
              </DialogFooter>
            </div>
          )}

          {importStep === 'preview' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Showing first 10 rows. Total: {parsedData.length} rows
              </p>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Guests</TableHead>
                      <TableHead>Errors</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {importPreview.map((row, i) => (
                      <TableRow key={i} className={row.errors.length > 0 ? 'bg-red-50' : ''}>
                        <TableCell>{row.rowNum}</TableCell>
                        <TableCell>{row.data.guestName || '-'}</TableCell>
                        <TableCell>{row.data.guestEmail || '-'}</TableCell>
                        <TableCell>{row.data.guestPhone || '-'}</TableCell>
                        <TableCell>{row.data.attending || 'pending'}</TableCell>
                        <TableCell>{row.data.partySize || '1'}</TableCell>
                        <TableCell>
                          {row.errors.length > 0 && (
                            <div className="flex items-center gap-1 text-destructive text-xs">
                              <AlertCircle className="h-3 w-3" />
                              {row.errors.join(', ')}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportStep('mapping')}>Back</Button>
                <Button onClick={executeImport}>
                  Import {parsedData.length} Guests
                </Button>
              </DialogFooter>
            </div>
          )}

          {importStep === 'importing' && (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg font-medium">Importing guests...</p>
              <p className="text-sm text-muted-foreground">Please don't close this window</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

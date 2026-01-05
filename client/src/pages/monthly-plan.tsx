import { useState, useMemo, useEffect, useCallback, useRef, KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { format, addMonths, subMonths } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Trash2,
  Calendar,
  Search,
  Plus,
  Edit2,
  Check,
  X,
  Users,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { MonthlyProductionPlan } from "@shared/schema";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type CellKey = `${string}::${string}`;

interface ColumnDef {
  key: string;
  label: string;
  shortLabel?: string;
  width: number;
  minWidth?: number;
  editable?: boolean;
  type?: "number" | "text" | "datetime";
  placeholder?: string;
  autocompleteUsers?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { key: "eventDate", label: "Event Date", shortLabel: "Date", width: 90, minWidth: 80 },
  { key: "subEventName", label: "Event", shortLabel: "Event", width: 150, minWidth: 120 },
  { key: "venue", label: "Venue", shortLabel: "Venue", width: 130, minWidth: 100 },
  { key: "weddingPlanner", label: "Wedding Planner", shortLabel: "Planner", width: 110, minWidth: 90, editable: true, placeholder: "-", autocompleteUsers: true },
  { key: "stageManager", label: "Stage Manager", shortLabel: "Coordinator", width: 120, minWidth: 100, editable: true, placeholder: "-", autocompleteUsers: true },
  { key: "teamLead", label: "Team Lead", shortLabel: "Lead", width: 100, minWidth: 80, editable: true, placeholder: "-", autocompleteUsers: true },
  { key: "productionTeamCount", label: "Team Count", shortLabel: "Count", width: 70, minWidth: 60, editable: true, type: "number", placeholder: "-" },
  { key: "florist", label: "Florist", shortLabel: "Florist", width: 100, minWidth: 80, editable: true, placeholder: "-", autocompleteUsers: true },
  { key: "loadingStartDateTime", label: "Loading Start", shortLabel: "Loading", width: 130, minWidth: 100, editable: true, type: "datetime", placeholder: "-" },
  { key: "productionStartTime", label: "Prod. Start", shortLabel: "Start", width: 130, minWidth: 100, editable: true, type: "datetime", placeholder: "-" },
  { key: "productionEndTime", label: "Prod. End", shortLabel: "End", width: 130, minWidth: 100, editable: true, type: "datetime", placeholder: "-" },
  { key: "dismantlingDateTime", label: "Dismantling", shortLabel: "Dismantle", width: 130, minWidth: 100, editable: true, type: "datetime", placeholder: "-" },
  { key: "dismantlingTeamLead", label: "Dis. Lead", shortLabel: "Dis. Lead", width: 100, minWidth: 80, editable: true, placeholder: "-", autocompleteUsers: true },
];

interface UserOption {
  id: number;
  name: string;
  email: string;
  role: string;
}

export default function MonthlyPlan() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSuperadmin = user?.role === "superadmin";
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [editingCell, setEditingCell] = useState<CellKey | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editGroupLabelId, setEditGroupLabelId] = useState<string | null>(null);
  const [groupLabelValue, setGroupLabelValue] = useState("");
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [autocompleteIndex, setAutocompleteIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<HTMLDivElement>(null);
  
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const { data: entries = [], isLoading } = useQuery<MonthlyProductionPlan[]>({
    queryKey: ["/api/monthly-plan", month, year],
    queryFn: async () => {
      const res = await fetch(`/api/monthly-plan?month=${month}&year=${year}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch monthly plan");
      return res.json();
    },
  });

  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await fetch("/api/users", { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      return data.map((u: any) => ({ id: u.id, name: u.name, email: u.email, role: u.role }));
    },
  });

  const filteredSuggestions = useMemo(() => {
    if (!editingCell || !editValue.trim()) return [];
    const [, colKey] = editingCell.split("::") as [string, string];
    const col = COLUMNS.find(c => c.key === colKey);
    if (!col?.autocompleteUsers) return [];
    
    const searchTerm = editValue.toLowerCase();
    return users
      .filter(u => u.name.toLowerCase().includes(searchTerm))
      .slice(0, 6);
  }, [editingCell, editValue, users]);

  const generateMutation = useMutation({
    mutationFn: async (showToast: boolean = true) => {
      const res = await fetch("/api/monthly-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ month, year }),
      });
      if (!res.ok) throw new Error("Failed to generate plan");
      return { data: await res.json(), showToast };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-plan", month, year] });
      if (result.showToast) {
        toast({ title: "Plan synced with events" });
      }
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (!isLoading) {
      generateMutation.mutate(false);
    }
  }, [month, year]);

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MonthlyProductionPlan> }) => {
      const res = await fetch(`/api/monthly-plan/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update entry");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-plan", month, year] });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/monthly-plan/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete entry");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-plan", month, year] });
      setDeleteId(null);
      toast({ title: "Entry deleted" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const sortedEntries = useMemo(() => {
    let filtered = [...entries].sort((a, b) => 
      new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    );
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(e => 
        e.subEventName?.toLowerCase().includes(q) ||
        e.venue?.toLowerCase().includes(q) ||
        e.teamLead?.toLowerCase().includes(q) ||
        e.weddingPlanner?.toLowerCase().includes(q) ||
        e.groupLabel?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [entries, searchQuery]);

  const groupedEntries = useMemo(() => {
    const groups: { label: string; entries: MonthlyProductionPlan[]; firstEntryId: string }[] = [];
    let currentGroup: MonthlyProductionPlan[] = [];
    let currentLabel = "";
    let firstEntryId = "";

    sortedEntries.forEach((entry, idx) => {
      if (entry.groupLabel && entry.groupLabel !== currentLabel) {
        if (currentGroup.length > 0) {
          groups.push({ label: currentLabel, entries: currentGroup, firstEntryId });
        }
        currentLabel = entry.groupLabel;
        currentGroup = [entry];
        firstEntryId = entry.id;
      } else if (!entry.groupLabel && currentLabel) {
        if (currentGroup.length > 0) {
          groups.push({ label: currentLabel, entries: currentGroup, firstEntryId });
        }
        currentLabel = "";
        currentGroup = [entry];
        firstEntryId = entry.id;
      } else {
        if (currentGroup.length === 0) {
          firstEntryId = entry.id;
        }
        currentGroup.push(entry);
      }
    });

    if (currentGroup.length > 0) {
      groups.push({ label: currentLabel, entries: currentGroup, firstEntryId });
    }

    return groups;
  }, [sortedEntries]);

  const getCellValue = useCallback((entry: MonthlyProductionPlan, key: string): string => {
    if (key === "eventDate") {
      return format(new Date(entry.eventDate), "dd-MMM-yy");
    }
    const val = entry[key as keyof MonthlyProductionPlan];
    return val != null ? String(val) : "";
  }, []);

  const startEditing = useCallback((rowId: string, colKey: string) => {
    if (!isSuperadmin) return;
    const col = COLUMNS.find(c => c.key === colKey);
    if (!col?.editable) return;
    
    const cellKey: CellKey = `${rowId}::${colKey}`;
    const entry = entries.find(e => e.id === rowId);
    if (!entry) return;
    
    setEditingCell(cellKey);
    setEditValue(getCellValue(entry, colKey));
    setShowAutocomplete(false);
    setAutocompleteIndex(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [isSuperadmin, entries, getCellValue]);

  const selectSuggestion = useCallback((name: string) => {
    setEditValue(name);
    setShowAutocomplete(false);
    setAutocompleteIndex(0);
  }, []);

  const commitEdit = useCallback(() => {
    if (!editingCell) return;
    
    const [rowId, colKey] = editingCell.split("::") as [string, string];
    const entry = entries.find(e => e.id === rowId);
    if (!entry) return;
    
    const originalValue = getCellValue(entry, colKey);
    if (editValue !== originalValue) {
      const col = COLUMNS.find(c => c.key === colKey);
      const dataValue = col?.type === "number" ? (editValue ? parseInt(editValue) : null) : (editValue || null);
      
      updateMutation.mutate({
        id: rowId,
        data: { [colKey]: dataValue },
      });
    }
    
    setEditingCell(null);
    setEditValue("");
    setShowAutocomplete(false);
    setAutocompleteIndex(0);
  }, [editingCell, editValue, entries, getCellValue, updateMutation]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue("");
    setShowAutocomplete(false);
    setAutocompleteIndex(0);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>, rowId: string, colKey: string) => {
    const editableColumns = COLUMNS.filter(c => c.editable);
    const currentColIndex = editableColumns.findIndex(c => c.key === colKey);
    const currentRowIndex = sortedEntries.findIndex(e => e.id === rowId);
    const col = COLUMNS.find(c => c.key === colKey);
    
    if (showAutocomplete && filteredSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setAutocompleteIndex(prev => Math.min(prev + 1, filteredSuggestions.length - 1));
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setAutocompleteIndex(prev => Math.max(prev - 1, 0));
        return;
      } else if (e.key === "Enter") {
        e.preventDefault();
        selectSuggestion(filteredSuggestions[autocompleteIndex].name);
        return;
      }
    }
    
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
      if (currentRowIndex < sortedEntries.length - 1) {
        const nextRow = sortedEntries[currentRowIndex + 1];
        setTimeout(() => startEditing(nextRow.id, colKey), 50);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      commitEdit();
      if (e.shiftKey && currentColIndex > 0) {
        const prevCol = editableColumns[currentColIndex - 1];
        setTimeout(() => startEditing(rowId, prevCol.key), 50);
      } else if (!e.shiftKey && currentColIndex < editableColumns.length - 1) {
        const nextCol = editableColumns[currentColIndex + 1];
        setTimeout(() => startEditing(rowId, nextCol.key), 50);
      } else if (!e.shiftKey && currentRowIndex < sortedEntries.length - 1) {
        const nextRow = sortedEntries[currentRowIndex + 1];
        setTimeout(() => startEditing(nextRow.id, editableColumns[0].key), 50);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (showAutocomplete) {
        setShowAutocomplete(false);
      } else {
        cancelEdit();
      }
    }
  }, [sortedEntries, commitEdit, cancelEdit, startEditing, showAutocomplete, filteredSuggestions, autocompleteIndex, selectSuggestion]);

  useEffect(() => {
    if (editingCell && editValue.trim()) {
      const [, colKey] = editingCell.split("::") as [string, string];
      const col = COLUMNS.find(c => c.key === colKey);
      if (col?.autocompleteUsers && filteredSuggestions.length > 0) {
        setShowAutocomplete(true);
        setAutocompleteIndex(0);
      } else {
        setShowAutocomplete(false);
      }
    } else {
      setShowAutocomplete(false);
    }
  }, [editValue, editingCell, filteredSuggestions.length]);

  const toggleComplete = useCallback((entry: MonthlyProductionPlan) => {
    if (!isSuperadmin) return;
    updateMutation.mutate({ 
      id: entry.id, 
      data: { isComplete: !entry.isComplete }
    });
  }, [isSuperadmin, updateMutation]);

  const saveGroupLabel = useCallback(() => {
    if (!editGroupLabelId) return;
    updateMutation.mutate({
      id: editGroupLabelId,
      data: { groupLabel: groupLabelValue || null },
    });
    setEditGroupLabelId(null);
    setGroupLabelValue("");
  }, [editGroupLabelId, groupLabelValue, updateMutation]);

  const downloadPDF = () => {
    const doc = new jsPDF("landscape", "mm", "a4");
    const monthName = format(currentDate, "MMMM yyyy");
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    
    doc.setFillColor(107, 153, 55);
    doc.rect(0, 0, pageWidth, 28, "F");
    
    doc.setFillColor(201, 169, 97);
    doc.rect(0, 28, pageWidth, 3, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("Oakstreet Events", 14, 15);
    
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text("Monthly Production Plan", 14, 23);
    
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(monthName, pageWidth - 14, 18, { align: "right" });
    
    doc.setTextColor(0, 0, 0);
    
    let startY = 38;
    
    groupedEntries.forEach((group, groupIndex) => {
      if (group.label) {
        if (startY > pageHeight - 30) {
          doc.addPage();
          startY = 20;
        }
        
        doc.setFillColor(74, 122, 37);
        doc.roundedRect(10, startY - 5, pageWidth - 20, 8, 1, 1, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(group.label, 14, startY);
        doc.setTextColor(0, 0, 0);
        startY += 8;
      }
      
      const tableData = group.entries.map(entry => [
        format(new Date(entry.eventDate), "dd-MMM-yy"),
        entry.subEventName || "-",
        entry.venue || "-",
        entry.weddingPlanner || "-",
        entry.stageManager || "-",
        entry.teamLead || "-",
        entry.productionTeamCount?.toString() || "-",
        entry.florist || "-",
        entry.loadingStartDateTime || "-",
        entry.productionStartTime || "-",
        entry.productionEndTime || "-",
        entry.dismantlingDateTime || "-",
        entry.dismantlingTeamLead || "-",
      ]);

      autoTable(doc, {
        startY,
        head: [[
          "Date", "Event", "Venue", "Planner", "Coordinator", "Lead", "Count", "Florist",
          "Loading", "Prod Start", "Prod End", "Dismantle", "Dis.Lead",
        ]],
        body: tableData,
        theme: "grid",
        headStyles: {
          fillColor: [107, 153, 55],
          textColor: [255, 255, 255],
          fontSize: 7,
          fontStyle: "bold",
          cellPadding: 2,
          halign: "center",
        },
        bodyStyles: { 
          fontSize: 7, 
          cellPadding: 2,
        },
        alternateRowStyles: {
          fillColor: [245, 250, 240],
        },
        columnStyles: {
          0: { cellWidth: 18, halign: "center" },
          1: { cellWidth: 28 },
          2: { cellWidth: 22 },
          3: { cellWidth: 20 },
          4: { cellWidth: 22 },
          5: { cellWidth: 18 },
          6: { cellWidth: 12, halign: "center" },
          7: { cellWidth: 18 },
          8: { cellWidth: 22 },
          9: { cellWidth: 22 },
          10: { cellWidth: 22 },
          11: { cellWidth: 22 },
          12: { cellWidth: 18 },
        },
        didParseCell: function(data) {
          if (data.section === 'body' && data.row.raw) {
            const entry = group.entries[data.row.index];
            if (entry?.isComplete) {
              data.cell.styles.fillColor = [220, 252, 231];
            }
          }
        },
        margin: { left: 10, right: 10 },
      });

      startY = (doc as any).lastAutoTable.finalY + 8;
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      
      doc.setFillColor(107, 153, 55);
      doc.rect(0, pageHeight - 12, pageWidth, 12, "F");
      
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text(
        `Generated on ${format(new Date(), "dd MMM yyyy, hh:mm a")}`,
        14,
        pageHeight - 5
      );
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth - 14,
        pageHeight - 5,
        { align: "right" }
      );
    }

    doc.save(`Oakstreet_Production_Plan_${monthName.replace(" ", "_")}.pdf`);
    toast({ title: "PDF downloaded successfully" });
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  const stats = useMemo(() => {
    const total = entries.length;
    const completed = entries.filter(e => e.isComplete).length;
    const withTeam = entries.filter(e => e.teamLead).length;
    return { total, completed, withTeam };
  }, [entries]);

  return (
    <div className="h-full flex flex-col gap-4 p-4 bg-gradient-to-br from-stone-50 to-amber-50/30">
      <motion.div
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-4"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-[#6b9937] to-[#4a7a25] shadow-lg">
            <Calendar className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold font-serif text-[#4a7a25]">Monthly Production Plan</h1>
            <p className="text-sm text-muted-foreground">Macro-level event scheduling</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-white border rounded-lg shadow-sm overflow-hidden">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-9 w-9 rounded-none" data-testid="button-prev-month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <AnimatePresence mode="wait">
              <motion.div
                key={format(currentDate, "MMMM yyyy")}
                className="px-4 py-2 min-w-[140px] text-center font-medium bg-gradient-to-r from-[#6b9937]/10 to-[#c9a961]/10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {format(currentDate, "MMMM yyyy")}
              </motion.div>
            </AnimatePresence>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-9 w-9 rounded-none" data-testid="button-next-month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-[180px] pl-9 bg-white"
              data-testid="input-search"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate(true)}
            disabled={generateMutation.isPending}
            className="h-9 gap-2"
            data-testid="button-sync"
          >
            <RefreshCw className={cn("h-4 w-4", generateMutation.isPending && "animate-spin")} />
            Sync
          </Button>
          <Button
            size="sm"
            onClick={downloadPDF}
            className="h-9 gap-2 bg-gradient-to-r from-[#6b9937] to-[#4a7a25] hover:from-[#5a8830] hover:to-[#3d6820]"
            data-testid="button-download-pdf"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="bg-white/80 backdrop-blur border-[#6b9937]/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-[#6b9937]/10">
                <Calendar className="h-5 w-5 text-[#6b9937]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#4a7a25]">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Events</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="bg-white/80 backdrop-blur border-green-200">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100">
                <Check className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="bg-white/80 backdrop-blur border-[#c9a961]/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-full bg-[#c9a961]/10">
                <Users className="h-5 w-5 text-[#c9a961]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#c9a961]">{stats.withTeam}</p>
                <p className="text-xs text-muted-foreground">Team Assigned</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className="flex-1 overflow-hidden"
      >
        <Card className="h-full flex flex-col bg-white shadow-lg border-0">
          <CardHeader className="py-3 px-4 border-b bg-gradient-to-r from-[#6b9937]/5 to-[#c9a961]/5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">Production Schedule</CardTitle>
              {isSuperadmin && (
                <p className="text-xs text-muted-foreground">Click any editable cell to edit • Tab to navigate • Enter to save</p>
              )}
            </div>
          </CardHeader>
          <CardContent className="flex-1 p-0 overflow-auto">
            {isLoading ? (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin mr-2" />
                Loading...
              </div>
            ) : sortedEntries.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-12">
                <Calendar className="h-12 w-12 mb-4 opacity-30" />
                <p className="text-lg font-medium">No events for {format(currentDate, "MMMM yyyy")}</p>
                <p className="text-sm">Events will appear here once synced from the calendar</p>
              </div>
            ) : (
              <div className="min-w-[1400px]">
                {groupedEntries.map((group, groupIndex) => (
                  <div key={groupIndex} className="border-b last:border-b-0">
                    {group.label && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-[#4a7a25] to-[#6b9937] text-white">
                        <MapPin className="h-4 w-4" />
                        {editGroupLabelId === group.firstEntryId ? (
                          <div className="flex items-center gap-2 flex-1">
                            <Input
                              value={groupLabelValue}
                              onChange={(e) => setGroupLabelValue(e.target.value)}
                              className="h-7 bg-white/90 text-gray-800 flex-1"
                              placeholder="Group label..."
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveGroupLabel();
                                if (e.key === 'Escape') { setEditGroupLabelId(null); setGroupLabelValue(""); }
                              }}
                            />
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20" onClick={saveGroupLabel}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-white hover:bg-white/20" onClick={() => { setEditGroupLabelId(null); setGroupLabelValue(""); }}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="font-semibold text-sm flex-1">{group.label}</span>
                            {isSuperadmin && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-white/80 hover:bg-white/20"
                                onClick={() => { setEditGroupLabelId(group.firstEntryId); setGroupLabelValue(group.label); }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {groupIndex === 0 || group.label ? (
                      <table className="w-full border-collapse text-xs">
                        <thead>
                          <tr className="bg-gray-100/80">
                            {isSuperadmin && (
                              <th className="w-10 px-2 py-2 text-center font-semibold text-gray-600 border-b border-r">✓</th>
                            )}
                            {COLUMNS.map((col) => (
                              <th
                                key={col.key}
                                className={cn(
                                  "px-2 py-2 text-left font-semibold text-gray-600 border-b border-r whitespace-nowrap",
                                  col.editable && "bg-blue-50/50"
                                )}
                                style={{ width: col.width, minWidth: col.minWidth }}
                              >
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span>{col.shortLabel || col.label}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>{col.label}</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </th>
                            ))}
                            {isSuperadmin && (
                              <th className="w-10 px-2 py-2 text-center font-semibold text-gray-600 border-b">Del</th>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {group.entries.map((entry, rowIndex) => {
                            const isComplete = entry.isComplete;
                            const rowBg = isComplete ? "bg-green-50" : rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50/50";
                            
                            return (
                              <tr key={entry.id} className={cn("group hover:bg-blue-50/30", rowBg)} data-testid={`row-${entry.id}`}>
                                {isSuperadmin && (
                                  <td className="px-2 py-1.5 text-center border-b border-r">
                                    <Checkbox
                                      checked={!!isComplete}
                                      onCheckedChange={() => toggleComplete(entry)}
                                      className="h-4 w-4"
                                      data-testid={`checkbox-complete-${entry.id}`}
                                    />
                                  </td>
                                )}
                                
                                {COLUMNS.map((col) => {
                                  const cellKey: CellKey = `${entry.id}::${col.key}`;
                                  const isEditing = editingCell === cellKey;
                                  const value = getCellValue(entry, col.key);
                                  
                                  return (
                                    <td
                                      key={col.key}
                                      className={cn(
                                        "px-2 py-1.5 border-b border-r transition-colors",
                                        col.editable && isSuperadmin && "cursor-cell hover:bg-blue-100/50",
                                        isEditing && "p-0 bg-blue-100"
                                      )}
                                      style={{ width: col.width, minWidth: col.minWidth }}
                                      onClick={() => col.editable && isSuperadmin && startEditing(entry.id, col.key)}
                                      data-testid={`cell-${entry.id}-${col.key}`}
                                    >
                                      {isEditing ? (
                                        <div className="relative">
                                          <input
                                            ref={inputRef}
                                            type={col.type === "number" ? "number" : "text"}
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={(e) => {
                                              const relatedTarget = e.relatedTarget as HTMLElement;
                                              if (relatedTarget?.closest('.autocomplete-dropdown')) {
                                                return;
                                              }
                                              setTimeout(commitEdit, 150);
                                            }}
                                            onKeyDown={(e) => handleKeyDown(e, entry.id, col.key)}
                                            className="w-full h-full px-2 py-1.5 text-xs border-0 outline-none bg-blue-50 focus:ring-2 focus:ring-blue-400"
                                            data-testid={`input-${entry.id}-${col.key}`}
                                            autoComplete="off"
                                          />
                                          {col.autocompleteUsers && showAutocomplete && filteredSuggestions.length > 0 && (
                                            <div 
                                              ref={autocompleteRef}
                                              className="autocomplete-dropdown absolute left-0 top-full z-50 w-48 bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-auto"
                                              data-testid={`autocomplete-${col.key}`}
                                            >
                                              {filteredSuggestions.map((suggestion, idx) => (
                                                <button
                                                  key={suggestion.id}
                                                  type="button"
                                                  className={cn(
                                                    "w-full px-3 py-2 text-left text-xs hover:bg-[#6b9937]/10 transition-colors",
                                                    idx === autocompleteIndex && "bg-[#6b9937]/20"
                                                  )}
                                                  onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    selectSuggestion(suggestion.name);
                                                    setTimeout(() => inputRef.current?.focus(), 0);
                                                  }}
                                                  data-testid={`suggestion-${suggestion.id}`}
                                                >
                                                  <div className="font-medium text-gray-900">{suggestion.name}</div>
                                                  <div className="text-gray-500 text-[10px] capitalize">{suggestion.role.replace('_', ' ')}</div>
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className={cn(
                                          "block truncate",
                                          !value && "text-gray-400",
                                          col.key === "subEventName" && "font-medium",
                                          col.key === "productionTeamCount" && value && "text-center font-semibold bg-[#6b9937]/10 rounded px-1"
                                        )}>
                                          {value || (col.editable && isSuperadmin ? "—" : "-")}
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                                
                                {isSuperadmin && (
                                  <td className="px-2 py-1.5 text-center border-b">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => setDeleteId(entry.id)}
                                      data-testid={`button-delete-${entry.id}`}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <table className="w-full border-collapse text-xs">
                        <tbody>
                          {group.entries.map((entry, rowIndex) => {
                            const isComplete = entry.isComplete;
                            const rowBg = isComplete ? "bg-green-50" : rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50/50";
                            
                            return (
                              <tr key={entry.id} className={cn("group hover:bg-blue-50/30", rowBg)} data-testid={`row-${entry.id}`}>
                                {isSuperadmin && (
                                  <td className="w-10 px-2 py-1.5 text-center border-b border-r">
                                    <Checkbox
                                      checked={!!isComplete}
                                      onCheckedChange={() => toggleComplete(entry)}
                                      className="h-4 w-4"
                                    />
                                  </td>
                                )}
                                
                                {COLUMNS.map((col) => {
                                  const cellKey: CellKey = `${entry.id}::${col.key}`;
                                  const isEditing = editingCell === cellKey;
                                  const value = getCellValue(entry, col.key);
                                  
                                  return (
                                    <td
                                      key={col.key}
                                      className={cn(
                                        "px-2 py-1.5 border-b border-r transition-colors",
                                        col.editable && isSuperadmin && "cursor-cell hover:bg-blue-100/50",
                                        isEditing && "p-0 bg-blue-100"
                                      )}
                                      style={{ width: col.width, minWidth: col.minWidth }}
                                      onClick={() => col.editable && isSuperadmin && startEditing(entry.id, col.key)}
                                    >
                                      {isEditing ? (
                                        <div className="relative">
                                          <input
                                            ref={inputRef}
                                            type={col.type === "number" ? "number" : "text"}
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            onBlur={(e) => {
                                              const relatedTarget = e.relatedTarget as HTMLElement;
                                              if (relatedTarget?.closest('.autocomplete-dropdown')) {
                                                return;
                                              }
                                              setTimeout(commitEdit, 150);
                                            }}
                                            onKeyDown={(e) => handleKeyDown(e, entry.id, col.key)}
                                            className="w-full h-full px-2 py-1.5 text-xs border-0 outline-none bg-blue-50 focus:ring-2 focus:ring-blue-400"
                                            autoComplete="off"
                                          />
                                          {col.autocompleteUsers && showAutocomplete && filteredSuggestions.length > 0 && (
                                            <div 
                                              className="autocomplete-dropdown absolute left-0 top-full z-50 w-48 bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-auto"
                                            >
                                              {filteredSuggestions.map((suggestion, idx) => (
                                                <button
                                                  key={suggestion.id}
                                                  type="button"
                                                  className={cn(
                                                    "w-full px-3 py-2 text-left text-xs hover:bg-[#6b9937]/10 transition-colors",
                                                    idx === autocompleteIndex && "bg-[#6b9937]/20"
                                                  )}
                                                  onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    selectSuggestion(suggestion.name);
                                                    setTimeout(() => inputRef.current?.focus(), 0);
                                                  }}
                                                >
                                                  <div className="font-medium text-gray-900">{suggestion.name}</div>
                                                  <div className="text-gray-500 text-[10px] capitalize">{suggestion.role.replace('_', ' ')}</div>
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ) : (
                                        <span className={cn(
                                          "block truncate",
                                          !value && "text-gray-400",
                                          col.key === "subEventName" && "font-medium"
                                        )}>
                                          {value || "-"}
                                        </span>
                                      )}
                                    </td>
                                  );
                                })}
                                
                                {isSuperadmin && (
                                  <td className="w-10 px-2 py-1.5 text-center border-b">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => setDeleteId(entry.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}

                    {isSuperadmin && groupIndex === groupedEntries.length - 1 && (
                      <div className="px-4 py-2 border-t bg-gray-50/50">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-[#6b9937]"
                          onClick={() => {
                            if (group.entries.length > 0) {
                              const lastEntry = group.entries[group.entries.length - 1];
                              setEditGroupLabelId(lastEntry.id);
                              setGroupLabelValue("");
                            }
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Group Section
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

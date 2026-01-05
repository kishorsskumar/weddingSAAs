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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useToast } from "@/hooks/use-toast";
import { MonthlyProductionPlan } from "@shared/schema";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type CellKey = `${string}::${string}`;

interface ColumnDef {
  key: string;
  label: string;
  width: number;
  readonly?: boolean;
  frozen?: boolean;
  editable?: boolean;
  type?: "number" | "text";
}

const COLUMNS: ColumnDef[] = [
  { key: "eventDate", label: "Date", width: 85, readonly: true, frozen: true },
  { key: "subEventName", label: "Event", width: 160, readonly: true, frozen: true },
  { key: "venue", label: "Venue", width: 120, readonly: true },
  { key: "teamLead", label: "Team Lead", width: 100, editable: true },
  { key: "productionTeamCount", label: "Count", width: 60, editable: true, type: "number" },
  { key: "florist", label: "Florist", width: 100, editable: true },
  { key: "loadingStartDateTime", label: "Loading", width: 110, editable: true },
  { key: "productionStartTime", label: "Prod Start", width: 110, editable: true },
  { key: "productionEndTime", label: "Prod End", width: 110, editable: true },
  { key: "dismantlingDateTime", label: "Dismantling", width: 110, editable: true },
  { key: "dismantlingTeamLead", label: "Dis. Lead", width: 100, editable: true },
];

export default function MonthlyPlan() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSuperadmin = user?.role === "superadmin";
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [focusedCell, setFocusedCell] = useState<CellKey | null>(null);
  const [editingCell, setEditingCell] = useState<CellKey | null>(null);
  const [editValue, setEditValue] = useState("");
  const [pendingChanges, setPendingChanges] = useState<Record<string, Record<string, string>>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  
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
        e.teamLead?.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [entries, searchQuery]);

  const getCellValue = useCallback((entry: MonthlyProductionPlan, key: string): string => {
    if (pendingChanges[entry.id]?.[key] !== undefined) {
      return pendingChanges[entry.id][key];
    }
    if (key === "eventDate") {
      return format(new Date(entry.eventDate), "dd-MMM-yy");
    }
    const val = entry[key as keyof MonthlyProductionPlan];
    return val != null ? String(val) : "";
  }, [pendingChanges]);

  const startEditing = useCallback((rowId: string, colKey: string) => {
    if (!isSuperadmin) return;
    const col = COLUMNS.find(c => c.key === colKey);
    if (!col?.editable) return;
    
    const cellKey: CellKey = `${rowId}::${colKey}`;
    const entry = entries.find(e => e.id === rowId);
    if (!entry) return;
    
    setFocusedCell(cellKey);
    setEditingCell(cellKey);
    setEditValue(getCellValue(entry, colKey));
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [isSuperadmin, entries, getCellValue]);

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
  }, [editingCell, editValue, entries, getCellValue, updateMutation]);

  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditValue("");
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>, rowId: string, colKey: string) => {
    const editableColumns = COLUMNS.filter(c => c.editable);
    const currentColIndex = editableColumns.findIndex(c => c.key === colKey);
    const currentRowIndex = sortedEntries.findIndex(e => e.id === rowId);
    
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit();
      // Move to next row same column
      if (currentRowIndex < sortedEntries.length - 1) {
        const nextRow = sortedEntries[currentRowIndex + 1];
        setTimeout(() => startEditing(nextRow.id, colKey), 50);
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      commitEdit();
      // Move to next/prev editable column
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
      cancelEdit();
    }
  }, [sortedEntries, commitEdit, cancelEdit, startEditing]);

  const toggleComplete = useCallback((entry: MonthlyProductionPlan) => {
    if (!isSuperadmin) return;
    updateMutation.mutate({ 
      id: entry.id, 
      data: { isComplete: !entry.isComplete }
    });
  }, [isSuperadmin, updateMutation]);

  const downloadPDF = () => {
    const doc = new jsPDF("landscape");
    const monthName = format(currentDate, "MMMM yyyy");
    
    doc.setFillColor(107, 153, 55);
    doc.rect(0, 0, doc.internal.pageSize.width, 30, "F");
    
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.text("Oakstreet Events", 14, 18);
    
    doc.setFontSize(12);
    doc.text(`Production Plan - ${monthName}`, doc.internal.pageSize.width - 14, 18, { align: "right" });
    
    doc.setTextColor(0, 0, 0);
    
    const tableData = sortedEntries.map(entry => [
      format(new Date(entry.eventDate), "dd-MMM-yy"),
      entry.subEventName || "-",
      entry.venue || "-",
      entry.teamLead || "-",
      entry.productionTeamCount || "-",
      entry.florist || "-",
      entry.loadingStartDateTime || "-",
      entry.productionStartTime || "-",
      entry.productionEndTime || "-",
      entry.dismantlingDateTime || "-",
      entry.dismantlingTeamLead || "-",
      entry.isComplete ? "Done" : "Pending",
    ]);

    autoTable(doc, {
      startY: 35,
      head: [[
        "Date", "Event", "Venue", "Team Lead", "Count", "Florist",
        "Loading", "Prod Start", "Prod End", "Dismantling", "Dis. Lead", "Status",
      ]],
      body: tableData,
      headStyles: {
        fillColor: [107, 153, 55],
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: "bold",
      },
      bodyStyles: { fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 18 }, 1: { cellWidth: 30 }, 2: { cellWidth: 25 },
        3: { cellWidth: 18 }, 4: { cellWidth: 12 }, 5: { cellWidth: 18 },
        6: { cellWidth: 22 }, 7: { cellWidth: 22 }, 8: { cellWidth: 22 },
        9: { cellWidth: 22 }, 10: { cellWidth: 18 }, 11: { cellWidth: 16 },
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.row.raw) {
          const rowData = data.row.raw as string[];
          if (rowData[11] === 'Done') {
            data.cell.styles.fillColor = [230, 244, 230];
          }
        }
      },
      margin: { top: 35 },
    });

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Generated on ${format(new Date(), "dd MMM yyyy, hh:mm a")} | Page ${i} of ${pageCount}`,
        doc.internal.pageSize.width / 2,
        doc.internal.pageSize.height - 10,
        { align: "center" }
      );
    }

    doc.save(`Production_Plan_${monthName.replace(" ", "_")}.pdf`);
    toast({ title: "PDF downloaded" });
  };

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  // Calculate frozen column offset
  const frozenWidth = COLUMNS.filter(c => c.frozen).reduce((sum, c) => sum + c.width, 0);

  return (
    <div className="h-full flex flex-col gap-3 px-2 sm:px-0">
      {/* Header */}
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-primary" />
          <h1 className="text-lg sm:text-xl font-bold font-serif text-primary">Monthly Production Plan</h1>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Month Navigation */}
          <div className="flex items-center bg-white border rounded shadow-sm">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8 rounded-none border-r" data-testid="button-prev-month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <AnimatePresence mode="wait">
              <motion.span
                key={format(currentDate, "MMMM yyyy")}
                className="text-xs font-medium min-w-[100px] text-center px-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                {format(currentDate, "MMM yyyy")}
              </motion.span>
            </AnimatePresence>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8 rounded-none border-l" data-testid="button-next-month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-[140px] pl-7 text-xs"
              data-testid="input-search"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate(true)}
            disabled={generateMutation.isPending}
            className="h-8 gap-1.5 text-xs"
            data-testid="button-sync"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", generateMutation.isPending && "animate-spin")} />
            Sync
          </Button>
          <Button
            size="sm"
            onClick={downloadPDF}
            className="h-8 gap-1.5 text-xs"
            data-testid="button-download-pdf"
          >
            <Download className="h-3.5 w-3.5" />
            PDF
          </Button>
        </div>
      </motion.div>

      {/* Spreadsheet */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="flex-1 border rounded-lg bg-white shadow-sm overflow-hidden"
      >
        {isLoading ? (
          <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
            Loading...
          </div>
        ) : sortedEntries.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
            <Calendar className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm">No events for {format(currentDate, "MMMM yyyy")}</p>
          </div>
        ) : (
          <div ref={tableRef} className="h-full overflow-auto">
            <table className="w-full border-collapse text-xs" style={{ minWidth: COLUMNS.reduce((sum, c) => sum + c.width, 0) + (isSuperadmin ? 80 : 0) }}>
              {/* Header */}
              <thead>
                <tr className="bg-gradient-to-b from-gray-100 to-gray-50">
                  {isSuperadmin && (
                    <th 
                      className="sticky top-0 left-0 z-30 bg-gradient-to-b from-gray-100 to-gray-50 border-b border-r border-gray-300 px-2 py-2 text-center font-semibold text-gray-700"
                      style={{ width: 40, minWidth: 40 }}
                    >
                      Done
                    </th>
                  )}
                  {COLUMNS.map((col, idx) => {
                    let leftOffset = isSuperadmin ? 40 : 0;
                    if (col.frozen) {
                      for (let i = 0; i < idx; i++) {
                        if (COLUMNS[i].frozen) leftOffset += COLUMNS[i].width;
                      }
                    }
                    return (
                      <th
                        key={col.key}
                        className={cn(
                          "sticky top-0 border-b border-r border-gray-300 px-2 py-2 text-left font-semibold text-gray-700 whitespace-nowrap bg-gradient-to-b from-gray-100 to-gray-50",
                          col.frozen ? "z-30" : "z-20"
                        )}
                        style={{ 
                          width: col.width, 
                          minWidth: col.width,
                          left: col.frozen ? leftOffset : undefined,
                        }}
                      >
                        {col.label}
                      </th>
                    );
                  })}
                  {isSuperadmin && (
                    <th 
                      className="sticky top-0 right-0 z-30 bg-gradient-to-b from-gray-100 to-gray-50 border-b border-l border-gray-300 px-2 py-2 text-center font-semibold text-gray-700"
                      style={{ width: 40, minWidth: 40 }}
                    >
                      Del
                    </th>
                  )}
                </tr>
              </thead>
              {/* Body */}
              <tbody>
                {sortedEntries.map((entry, rowIndex) => {
                  const isComplete = entry.isComplete;
                  const rowBg = isComplete ? "bg-green-100" : rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50/50";
                  const hoverBg = isComplete ? "hover:bg-green-200/70" : "hover:bg-blue-50/50";
                  
                  return (
                    <tr 
                      key={entry.id} 
                      className={cn("group", rowBg, hoverBg)}
                      data-testid={`row-${entry.id}`}
                    >
                      {/* Completion Checkbox */}
                      {isSuperadmin && (
                        <td 
                          className={cn("sticky left-0 z-10 border-b border-r border-gray-200 px-2 py-1.5 text-center", rowBg, isComplete ? "group-hover:bg-green-200/70" : "group-hover:bg-blue-50/50")}
                          style={{ width: 40, minWidth: 40 }}
                        >
                          <Checkbox
                            checked={!!isComplete}
                            onCheckedChange={() => toggleComplete(entry)}
                            className="h-4 w-4"
                            data-testid={`checkbox-complete-${entry.id}`}
                          />
                        </td>
                      )}
                      
                      {/* Data Cells */}
                      {COLUMNS.map((col, idx) => {
                        const cellKey: CellKey = `${entry.id}::${col.key}`;
                        const isEditing = editingCell === cellKey;
                        const isFocused = focusedCell === cellKey;
                        const value = getCellValue(entry, col.key);
                        
                        let leftOffset = isSuperadmin ? 40 : 0;
                        if (col.frozen) {
                          for (let i = 0; i < idx; i++) {
                            if (COLUMNS[i].frozen) leftOffset += COLUMNS[i].width;
                          }
                        }
                        
                        return (
                          <td
                            key={col.key}
                            className={cn(
                              "border-b border-r border-gray-200 px-2 py-1.5 transition-colors cursor-default",
                              col.frozen && cn("sticky z-10", rowBg, isComplete ? "group-hover:bg-green-200/70" : "group-hover:bg-blue-50/50"),
                              col.editable && isSuperadmin && "cursor-cell hover:bg-blue-100/50",
                              isFocused && "ring-2 ring-inset ring-blue-400",
                              isEditing && "p-0"
                            )}
                            style={{ 
                              width: col.width, 
                              minWidth: col.width,
                              left: col.frozen ? leftOffset : undefined,
                            }}
                            onClick={() => {
                              if (col.editable && isSuperadmin) {
                                startEditing(entry.id, col.key);
                              }
                            }}
                            onFocus={() => setFocusedCell(cellKey)}
                            onBlur={() => setFocusedCell(null)}
                            tabIndex={col.editable && isSuperadmin ? 0 : -1}
                            data-testid={`cell-${entry.id}-${col.key}`}
                          >
                            {isEditing ? (
                              <input
                                ref={inputRef}
                                type={col.type === "number" ? "number" : "text"}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={commitEdit}
                                onKeyDown={(e) => handleKeyDown(e, entry.id, col.key)}
                                className="w-full h-full px-2 py-1.5 text-xs border-0 outline-none bg-blue-50 focus:ring-2 focus:ring-blue-400"
                                data-testid={`input-${entry.id}-${col.key}`}
                              />
                            ) : (
                              <span className={cn("block truncate", !value && "text-gray-400")}>
                                {value || (col.editable && isSuperadmin ? "—" : "-")}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      
                      {/* Delete Button */}
                      {isSuperadmin && (
                        <td 
                          className={cn("sticky right-0 z-10 border-b border-l border-gray-200 px-2 py-1.5 text-center", rowBg, isComplete ? "group-hover:bg-green-200/70" : "group-hover:bg-blue-50/50")}
                          style={{ width: 40, minWidth: 40 }}
                        >
                          <button
                            onClick={() => setDeleteId(entry.id)}
                            className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                            data-testid={`button-delete-${entry.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Footer Stats */}
      <div className="shrink-0 flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{sortedEntries.length} event{sortedEntries.length !== 1 ? "s" : ""}</span>
        <span>{sortedEntries.filter(e => e.isComplete).length} completed</span>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this production plan entry? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

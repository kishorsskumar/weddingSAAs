import { useState, useMemo, useEffect, useCallback } from "react";
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
  Save,
  X,
  Calendar,
  Check,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export default function MonthlyPlan() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSuperadmin = user?.role === "superadmin";
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Record<string, string>>({});
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
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
      setEditingId(null);
      setEditData({});
      toast({ title: "Entry updated" });
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
    return [...entries].sort((a, b) => 
      new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
    );
  }, [entries]);

  const startEdit = useCallback((entry: MonthlyProductionPlan) => {
    setEditingId(entry.id);
    setEditData({
      teamLead: entry.teamLead || "",
      productionTeamCount: String(entry.productionTeamCount || ""),
      florist: entry.florist || "",
      loadingStartDateTime: entry.loadingStartDateTime || "",
      productionStartTime: entry.productionStartTime || "",
      productionEndTime: entry.productionEndTime || "",
      dismantlingDateTime: entry.dismantlingDateTime || "",
      dismantlingTeamLead: entry.dismantlingTeamLead || "",
    });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setEditData({});
  }, []);

  const handleFieldChange = useCallback((field: string, value: string) => {
    setEditData(prev => ({ ...prev, [field]: value }));
  }, []);

  const saveEdit = useCallback((id: string) => {
    updateMutation.mutate({ 
      id, 
      data: {
        teamLead: editData.teamLead || null,
        productionTeamCount: editData.productionTeamCount ? parseInt(editData.productionTeamCount) : null,
        florist: editData.florist || null,
        loadingStartDateTime: editData.loadingStartDateTime || null,
        productionStartTime: editData.productionStartTime || null,
        productionEndTime: editData.productionEndTime || null,
        dismantlingDateTime: editData.dismantlingDateTime || null,
        dismantlingTeamLead: editData.dismantlingTeamLead || null,
      }
    });
  }, [editData, updateMutation]);

  const toggleComplete = useCallback((entry: MonthlyProductionPlan) => {
    updateMutation.mutate({ 
      id: entry.id, 
      data: { isComplete: !entry.isComplete }
    });
  }, [updateMutation]);

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
      entry.isComplete ? "Complete" : "Pending",
    ]);

    autoTable(doc, {
      startY: 35,
      head: [[
        "Date",
        "Event",
        "Venue",
        "Team Lead",
        "Count",
        "Florist",
        "Loading",
        "Prod Start",
        "Prod End",
        "Dismantling",
        "Dis. Lead",
        "Status",
      ]],
      body: tableData,
      headStyles: {
        fillColor: [107, 153, 55],
        textColor: [255, 255, 255],
        fontSize: 7,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 7,
      },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 30 },
        2: { cellWidth: 25 },
        3: { cellWidth: 18 },
        4: { cellWidth: 12 },
        5: { cellWidth: 18 },
        6: { cellWidth: 22 },
        7: { cellWidth: 22 },
        8: { cellWidth: 22 },
        9: { cellWidth: 22 },
        10: { cellWidth: 18 },
        11: { cellWidth: 16 },
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.row.raw) {
          const rowData = data.row.raw as string[];
          if (rowData[11] === 'Complete') {
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

  return (
    <div className="space-y-4 h-full flex flex-col px-2 sm:px-0">
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <h1 className="text-xl sm:text-2xl font-bold font-serif text-primary">Monthly Plan</h1>
          </div>
          <div className="flex items-center gap-2 bg-card border rounded-md p-1 w-fit">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-8 w-8" data-testid="button-prev-month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <AnimatePresence mode="wait">
              <motion.span
                key={format(currentDate, "MMMM yyyy")}
                className="text-xs sm:text-sm font-medium min-w-[100px] sm:min-w-[140px] text-center"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {format(currentDate, "MMMM yyyy")}
              </motion.span>
            </AnimatePresence>
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-8 w-8" data-testid="button-next-month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => generateMutation.mutate(true)}
            disabled={generateMutation.isPending}
            className="gap-2"
            data-testid="button-generate-plan"
          >
            <RefreshCw className={`h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
            Sync Events
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={downloadPDF}
            className="gap-2"
            data-testid="button-download-pdf"
          >
            <Download className="h-4 w-4" />
            PDF
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="flex-1"
      >
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : sortedEntries.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No events for this month</p>
            </div>
          ) : (
            <div className="overflow-auto max-h-[calc(100vh-220px)]">
              <Table className="relative">
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold text-primary text-xs w-[85px] min-w-[85px] sticky top-0 left-0 z-30 bg-[hsl(var(--primary)/0.1)]">Date</TableHead>
                    <TableHead className="font-bold text-primary text-xs w-[140px] min-w-[140px] sticky top-0 left-[85px] z-30 bg-[hsl(var(--primary)/0.1)]">Event</TableHead>
                    <TableHead className="font-bold text-primary text-xs min-w-[100px] sticky top-0 z-20 bg-[hsl(var(--primary)/0.1)]">Venue</TableHead>
                    <TableHead className="font-bold text-primary text-xs min-w-[90px] sticky top-0 z-20 bg-[hsl(var(--primary)/0.1)]">Team Lead</TableHead>
                    <TableHead className="font-bold text-primary text-xs min-w-[60px] text-center sticky top-0 z-20 bg-[hsl(var(--primary)/0.1)]">Count</TableHead>
                    <TableHead className="font-bold text-primary text-xs min-w-[90px] sticky top-0 z-20 bg-[hsl(var(--primary)/0.1)]">Florist</TableHead>
                    <TableHead className="font-bold text-primary text-xs min-w-[100px] sticky top-0 z-20 bg-[hsl(var(--primary)/0.1)]">Loading</TableHead>
                    <TableHead className="font-bold text-primary text-xs min-w-[100px] sticky top-0 z-20 bg-[hsl(var(--primary)/0.1)]">Prod Start</TableHead>
                    <TableHead className="font-bold text-primary text-xs min-w-[100px] sticky top-0 z-20 bg-[hsl(var(--primary)/0.1)]">Prod End</TableHead>
                    <TableHead className="font-bold text-primary text-xs min-w-[100px] sticky top-0 z-20 bg-[hsl(var(--primary)/0.1)]">Dismantling</TableHead>
                    <TableHead className="font-bold text-primary text-xs min-w-[90px] sticky top-0 z-20 bg-[hsl(var(--primary)/0.1)]">Dis. Lead</TableHead>
                    {isSuperadmin && (
                      <TableHead className="font-bold text-primary text-xs min-w-[160px] text-right sticky top-0 right-0 z-30 bg-[hsl(var(--primary)/0.1)]">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedEntries.map((entry) => {
                    const isEditing = editingId === entry.id;
                    const isComplete = entry.isComplete;
                    const rowBg = isComplete ? "bg-[#E6F4E6]" : "bg-card";
                    const rowBgHover = isComplete ? "hover:bg-[#D4ECD4]" : "hover:bg-muted/20";
                    
                    return (
                      <TableRow 
                        key={entry.id} 
                        className={cn("transition-colors", rowBg, rowBgHover)} 
                        data-testid={`row-entry-${entry.id}`}
                      >
                        <TableCell className={cn("text-xs font-medium w-[85px] min-w-[85px] sticky left-0 z-10", rowBg)}>
                          {format(new Date(entry.eventDate), "dd-MMM-yy")}
                        </TableCell>
                        <TableCell className={cn("text-xs font-medium w-[140px] min-w-[140px] sticky left-[85px] z-10", rowBg)}>
                          {entry.subEventName || "-"}
                        </TableCell>
                        <TableCell className="text-xs">{entry.venue || "-"}</TableCell>
                        <TableCell className="text-xs">
                          {isEditing ? (
                            <Input
                              value={editData.teamLead}
                              onChange={(e) => handleFieldChange("teamLead", e.target.value)}
                              className="h-8 text-xs min-w-[80px]"
                              placeholder="Team Lead"
                              data-testid="input-teamLead"
                            />
                          ) : (entry.teamLead || "-")}
                        </TableCell>
                        <TableCell className="text-xs text-center">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editData.productionTeamCount}
                              onChange={(e) => handleFieldChange("productionTeamCount", e.target.value)}
                              className="h-8 text-xs w-16"
                              data-testid="input-team-count"
                            />
                          ) : (entry.productionTeamCount || "-")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {isEditing ? (
                            <Input
                              value={editData.florist}
                              onChange={(e) => handleFieldChange("florist", e.target.value)}
                              className="h-8 text-xs min-w-[80px]"
                              placeholder="Florist"
                              data-testid="input-florist"
                            />
                          ) : (entry.florist || "-")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {isEditing ? (
                            <Input
                              value={editData.loadingStartDateTime}
                              onChange={(e) => handleFieldChange("loadingStartDateTime", e.target.value)}
                              className="h-8 text-xs min-w-[80px]"
                              placeholder="e.g. 20 Dec-5PM"
                              data-testid="input-loadingStartDateTime"
                            />
                          ) : (entry.loadingStartDateTime || "-")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {isEditing ? (
                            <Input
                              value={editData.productionStartTime}
                              onChange={(e) => handleFieldChange("productionStartTime", e.target.value)}
                              className="h-8 text-xs min-w-[80px]"
                              placeholder="e.g. 20 Dec-7PM"
                              data-testid="input-productionStartTime"
                            />
                          ) : (entry.productionStartTime || "-")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {isEditing ? (
                            <Input
                              value={editData.productionEndTime}
                              onChange={(e) => handleFieldChange("productionEndTime", e.target.value)}
                              className="h-8 text-xs min-w-[80px]"
                              placeholder="e.g. 20 Dec-10PM"
                              data-testid="input-productionEndTime"
                            />
                          ) : (entry.productionEndTime || "-")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {isEditing ? (
                            <Input
                              value={editData.dismantlingDateTime}
                              onChange={(e) => handleFieldChange("dismantlingDateTime", e.target.value)}
                              className="h-8 text-xs min-w-[80px]"
                              placeholder="e.g. 21 Dec-11PM"
                              data-testid="input-dismantlingDateTime"
                            />
                          ) : (entry.dismantlingDateTime || "-")}
                        </TableCell>
                        <TableCell className="text-xs">
                          {isEditing ? (
                            <Input
                              value={editData.dismantlingTeamLead}
                              onChange={(e) => handleFieldChange("dismantlingTeamLead", e.target.value)}
                              className="h-8 text-xs min-w-[80px]"
                              placeholder="Dis. Lead"
                              data-testid="input-dismantlingTeamLead"
                            />
                          ) : (entry.dismantlingTeamLead || "-")}
                        </TableCell>
                        {isSuperadmin && (
                          <TableCell className={cn("sticky right-0 z-10", rowBg)}>
                            <div className="flex items-center justify-end gap-1">
                              {isEditing ? (
                                <>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="h-7 gap-1 text-xs"
                                    onClick={() => saveEdit(entry.id)}
                                    disabled={updateMutation.isPending}
                                    data-testid={`button-save-${entry.id}`}
                                  >
                                    <Save className="h-3 w-3" />
                                    Save
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={cancelEdit}
                                    data-testid={`button-cancel-${entry.id}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs"
                                    onClick={() => startEdit(entry)}
                                    data-testid={`button-edit-${entry.id}`}
                                  >
                                    Edit
                                  </Button>
                                  <Button
                                    variant={isComplete ? "default" : "outline"}
                                    size="sm"
                                    className={cn("h-7 text-xs gap-1", isComplete && "bg-[#6b9937] hover:bg-[#5a8230]")}
                                    onClick={() => toggleComplete(entry)}
                                    data-testid={`button-complete-${entry.id}`}
                                  >
                                    {isComplete ? (
                                      <>
                                        <CheckCircle2 className="h-3 w-3" />
                                        Done
                                      </>
                                    ) : (
                                      <>
                                        <Check className="h-3 w-3" />
                                        Complete
                                      </>
                                    )}
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    onClick={() => setDeleteId(entry.id)}
                                    data-testid={`button-delete-${entry.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </motion.div>

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

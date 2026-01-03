import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/auth-context";
import { format, addMonths, subMonths } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  RefreshCw,
  Edit,
  Trash2,
  Plus,
  Save,
  X,
  Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function MonthlyPlan() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isSuperadmin = user?.role === "superadmin";
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingEntry, setEditingEntry] = useState<MonthlyProductionPlan | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<MonthlyProductionPlan>>({});
  
  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  const { data: entries = [], isLoading, refetch } = useQuery<MonthlyProductionPlan[]>({
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
    mutationFn: async () => {
      const res = await fetch("/api/monthly-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ month, year }),
      });
      if (!res.ok) throw new Error("Failed to generate plan");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/monthly-plan", month, year] });
      toast({ title: "Plan generated from events" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

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
      setIsEditDialogOpen(false);
      setEditingEntry(null);
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

  const groupedEntries = useMemo(() => {
    const groups: Record<string, MonthlyProductionPlan[]> = {};
    entries.forEach(entry => {
      const dateKey = entry.eventDate;
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(entry);
    });
    return Object.entries(groups).sort((a, b) => 
      new Date(a[0]).getTime() - new Date(b[0]).getTime()
    );
  }, [entries]);

  const handleEdit = (entry: MonthlyProductionPlan) => {
    setEditingEntry(entry);
    setFormData({
      subEventName: entry.subEventName,
      venue: entry.venue,
      teamLead: entry.teamLead,
      productionTeamCount: entry.productionTeamCount,
      florist: entry.florist,
      loadingStartDateTime: entry.loadingStartDateTime,
      productionStartTime: entry.productionStartTime,
      productionEndTime: entry.productionEndTime,
      dismantlingDateTime: entry.dismantlingDateTime,
      dismantlingTeamLead: entry.dismantlingTeamLead,
    });
    setIsEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingEntry) return;
    updateMutation.mutate({ id: editingEntry.id, data: formData });
  };

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
    
    const tableData: any[] = [];
    
    groupedEntries.forEach(([dateKey, dateEntries]) => {
      const eventDate = format(new Date(dateKey), "dd MMM yyyy");
      const firstEntry = dateEntries[0];
      
      tableData.push([
        { content: `${firstEntry.subEventName} - ${eventDate}`, colSpan: 10, styles: { fillColor: [245, 245, 245], fontStyle: 'bold', fontSize: 10 } }
      ]);
      
      dateEntries.forEach((entry) => {
        tableData.push([
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
        ]);
      });
    });

    autoTable(doc, {
      startY: 35,
      head: [[
        "Event Date",
        "Event",
        "Venue",
        "Team Lead",
        "Team Count",
        "Florist",
        "Loading Start",
        "Production Start",
        "Production End",
        "Dismantling",
        "Dismantling Lead",
      ]],
      body: tableData,
      headStyles: {
        fillColor: [107, 153, 55],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 35 },
        2: { cellWidth: 30 },
        3: { cellWidth: 20 },
        4: { cellWidth: 15 },
        5: { cellWidth: 20 },
        6: { cellWidth: 25 },
        7: { cellWidth: 25 },
        8: { cellWidth: 25 },
        9: { cellWidth: 25 },
        10: { cellWidth: 25 },
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
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
    <div className="space-y-4 sm:space-y-6 h-full flex flex-col px-2 sm:px-0">
      <motion.div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" />
            <h1 className="text-xl sm:text-3xl font-bold font-serif text-primary">Monthly Plan</h1>
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
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="gap-2"
            data-testid="button-generate-plan"
          >
            <RefreshCw className={`h-4 w-4 ${generateMutation.isPending ? "animate-spin" : ""}`} />
            {generateMutation.isPending ? "Generating..." : "Generate from Events"}
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={downloadPDF}
            className="gap-2"
            data-testid="button-download-pdf"
          >
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <Card className="overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No production plan entries for this month</p>
              <Button
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Generate from Events
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-primary/10">
                    <TableHead className="font-bold text-primary whitespace-nowrap">Event Date</TableHead>
                    <TableHead className="font-bold text-primary whitespace-nowrap">Event</TableHead>
                    <TableHead className="font-bold text-primary whitespace-nowrap">Venue</TableHead>
                    <TableHead className="font-bold text-primary whitespace-nowrap">Team Lead</TableHead>
                    <TableHead className="font-bold text-primary whitespace-nowrap text-center">Team Count</TableHead>
                    <TableHead className="font-bold text-primary whitespace-nowrap">Florist</TableHead>
                    <TableHead className="font-bold text-primary whitespace-nowrap">Loading Start</TableHead>
                    <TableHead className="font-bold text-primary whitespace-nowrap">Production Start</TableHead>
                    <TableHead className="font-bold text-primary whitespace-nowrap">Production End</TableHead>
                    <TableHead className="font-bold text-primary whitespace-nowrap">Dismantling</TableHead>
                    <TableHead className="font-bold text-primary whitespace-nowrap">Dismantling Lead</TableHead>
                    {isSuperadmin && (
                      <TableHead className="font-bold text-primary whitespace-nowrap text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedEntries.map(([dateKey, dateEntries], groupIndex) => (
                    <>
                      <TableRow key={`group-${dateKey}`} className="bg-muted/30">
                        <TableCell colSpan={isSuperadmin ? 12 : 11} className="font-semibold text-sm py-2">
                          {dateEntries[0]?.subEventName?.split(' - ')[0] || 'Event'} - {format(new Date(dateKey), "dd MMM yyyy")}
                        </TableCell>
                      </TableRow>
                      {dateEntries.map((entry, index) => (
                        <TableRow key={entry.id} className="hover:bg-muted/20" data-testid={`row-entry-${entry.id}`}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {format(new Date(entry.eventDate), "dd-MMM-yy")}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{entry.subEventName || "-"}</TableCell>
                          <TableCell className="text-sm">{entry.venue || "-"}</TableCell>
                          <TableCell className="text-sm">{entry.teamLead || "-"}</TableCell>
                          <TableCell className="text-sm text-center">{entry.productionTeamCount || "-"}</TableCell>
                          <TableCell className="text-sm">{entry.florist || "-"}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{entry.loadingStartDateTime || "-"}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{entry.productionStartTime || "-"}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{entry.productionEndTime || "-"}</TableCell>
                          <TableCell className="text-sm whitespace-nowrap">{entry.dismantlingDateTime || "-"}</TableCell>
                          <TableCell className="text-sm">{entry.dismantlingTeamLead || "-"}</TableCell>
                          {isSuperadmin && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-primary"
                                  onClick={() => handleEdit(entry)}
                                  data-testid={`button-edit-${entry.id}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => setDeleteId(entry.id)}
                                  data-testid={`button-delete-${entry.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </motion.div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Production Plan Entry</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="subEventName">Event Name</Label>
                <Input
                  id="subEventName"
                  value={formData.subEventName || ""}
                  onChange={(e) => setFormData({ ...formData, subEventName: e.target.value })}
                  data-testid="input-sub-event-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue">Venue</Label>
                <Input
                  id="venue"
                  value={formData.venue || ""}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  data-testid="input-venue"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="teamLead">Team Lead</Label>
                <Input
                  id="teamLead"
                  value={formData.teamLead || ""}
                  onChange={(e) => setFormData({ ...formData, teamLead: e.target.value })}
                  data-testid="input-team-lead"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="productionTeamCount">Team Count</Label>
                <Input
                  id="productionTeamCount"
                  type="number"
                  value={formData.productionTeamCount || ""}
                  onChange={(e) => setFormData({ ...formData, productionTeamCount: parseInt(e.target.value) || null })}
                  data-testid="input-team-count"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="florist">Florist</Label>
                <Input
                  id="florist"
                  value={formData.florist || ""}
                  onChange={(e) => setFormData({ ...formData, florist: e.target.value })}
                  data-testid="input-florist"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="loadingStartDateTime">Loading Start Date & Time</Label>
                <Input
                  id="loadingStartDateTime"
                  value={formData.loadingStartDateTime || ""}
                  onChange={(e) => setFormData({ ...formData, loadingStartDateTime: e.target.value })}
                  placeholder="e.g., 20 Dec- 5 PM"
                  data-testid="input-loading-start"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="productionStartTime">Production Start Time</Label>
                <Input
                  id="productionStartTime"
                  value={formData.productionStartTime || ""}
                  onChange={(e) => setFormData({ ...formData, productionStartTime: e.target.value })}
                  placeholder="e.g., 20 Dec- 7 PM"
                  data-testid="input-production-start"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="productionEndTime">Production End Time</Label>
                <Input
                  id="productionEndTime"
                  value={formData.productionEndTime || ""}
                  onChange={(e) => setFormData({ ...formData, productionEndTime: e.target.value })}
                  placeholder="e.g., 20 Dec- 10 PM"
                  data-testid="input-production-end"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dismantlingDateTime">Dismantling Date & Time</Label>
                <Input
                  id="dismantlingDateTime"
                  value={formData.dismantlingDateTime || ""}
                  onChange={(e) => setFormData({ ...formData, dismantlingDateTime: e.target.value })}
                  placeholder="e.g., 21 Dec- 11 PM"
                  data-testid="input-dismantling"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dismantlingTeamLead">Dismantling Team Lead</Label>
              <Input
                id="dismantlingTeamLead"
                value={formData.dismantlingTeamLead || ""}
                onChange={(e) => setFormData({ ...formData, dismantlingTeamLead: e.target.value })}
                data-testid="input-dismantling-lead"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="gap-2"
              data-testid="button-save-entry"
            >
              <Save className="h-4 w-4" />
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

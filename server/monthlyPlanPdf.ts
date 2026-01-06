import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import type { MonthlyProductionPlan } from "@shared/schema";

export function generateMonthlyPlanPDF(
  entries: MonthlyProductionPlan[],
  month: number,
  year: number
): Buffer {
  const doc = new jsPDF("landscape", "mm", "a4");
  const monthName = format(new Date(year, month - 1, 1), "MMMM yyyy");
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
  doc.text("Monthly Production Plan", 14, 26);

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(monthName, pageWidth - 14, 18, { align: "right" });

  doc.setTextColor(0, 0, 0);

  const sortedEntries = [...entries].sort((a, b) => 
    new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime()
  );

  const tableData = sortedEntries.map((entry) => [
    format(new Date(entry.eventDate), "dd-MMM"),
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

  const startY = 38;

  autoTable(doc, {
    startY,
    head: [
      [
        "Date",
        "Event",
        "Venue",
        "Planner",
        "Stg Mgr",
        "Lead",
        "Team",
        "Florist",
        "Loading",
        "Start",
        "End",
        "Dismantle",
        "Dis.Lead",
      ],
    ],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [107, 153, 55],
      textColor: [255, 255, 255],
      fontSize: 7,
      fontStyle: "bold",
      cellPadding: 2.5,
      halign: "center",
      valign: "middle",
      lineWidth: 0.2,
      lineColor: [80, 120, 45],
      minCellHeight: 8,
    },
    bodyStyles: {
      fontSize: 7,
      cellPadding: 2.5,
      lineWidth: 0.15,
      lineColor: [180, 180, 180],
      valign: "middle",
      minCellHeight: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 252, 245],
    },
    columnStyles: {
      0: { cellWidth: 16, halign: "center" },
      1: { cellWidth: 30 },
      2: { cellWidth: 26 },
      3: { cellWidth: 18 },
      4: { cellWidth: 18 },
      5: { cellWidth: 20 },
      6: { cellWidth: 12, halign: "center" },
      7: { cellWidth: 18 },
      8: { cellWidth: 24 },
      9: { cellWidth: 24 },
      10: { cellWidth: 24 },
      11: { cellWidth: 24 },
      12: { cellWidth: 20 },
    },
    styles: {
      overflow: "ellipsize",
    },
    margin: { left: 8, right: 8 },
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
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 14, pageHeight - 5, {
      align: "right",
    });
  }

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}

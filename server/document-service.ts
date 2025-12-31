import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { storage } from './storage';
import { randomUUID } from 'crypto';

interface GeneratedDocument {
  id: string;
  filename: string;
  contentType: string;
  data: Buffer;
  createdAt: Date;
  expiresAt: Date;
}

const documentStore = new Map<string, GeneratedDocument>();

setInterval(() => {
  const now = new Date();
  const entries = Array.from(documentStore.entries());
  entries.forEach(([id, doc]) => {
    if (doc.expiresAt < now) {
      documentStore.delete(id);
    }
  });
}, 60000);

export function getDocument(id: string): GeneratedDocument | undefined {
  const doc = documentStore.get(id);
  if (doc && doc.expiresAt > new Date()) {
    return doc;
  }
  if (doc) {
    documentStore.delete(id);
  }
  return undefined;
}

function storeDocument(filename: string, contentType: string, data: Buffer): string {
  const id = randomUUID();
  const doc: GeneratedDocument = {
    id,
    filename,
    contentType,
    data,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  };
  documentStore.set(id, doc);
  return id;
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export async function generateSalesReportPdf(options: {
  startDate?: string;
  endDate?: string;
  planner?: string;
  eventType?: string;
}): Promise<{ documentId: string; filename: string; message: string }> {
  let events = await storage.getAllEvents();
  
  if (options.startDate) {
    events = events.filter(e => e.date >= options.startDate!);
  }
  if (options.endDate) {
    events = events.filter(e => e.date <= options.endDate!);
  }
  if (options.planner) {
    events = events.filter(e => e.planner?.toLowerCase().includes(options.planner!.toLowerCase()));
  }
  if (options.eventType) {
    events = events.filter(e => e.type?.toLowerCase() === options.eventType!.toLowerCase());
  }
  
  events.sort((a, b) => a.date.localeCompare(b.date));
  
  const totalSales = events.reduce((sum, e) => sum + Number(e.salesValue || 0), 0);
  const totalReceived = events.reduce((sum, e) => sum + Number(e.paymentReceived || 0), 0);
  const totalOutstanding = totalSales - totalReceived;
  
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Oak Street Events', 105, 20, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('Sales Report', 105, 30, { align: 'center' });
  
  doc.setFontSize(10);
  const filterText = [];
  if (options.startDate) filterText.push(`From: ${formatDate(options.startDate)}`);
  if (options.endDate) filterText.push(`To: ${formatDate(options.endDate)}`);
  if (options.planner) filterText.push(`Planner: ${options.planner}`);
  if (options.eventType) filterText.push(`Type: ${options.eventType}`);
  if (filterText.length === 0) filterText.push('All Events');
  doc.text(filterText.join(' | '), 105, 38, { align: 'center' });
  
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 105, 45, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary', 14, 55);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Events: ${events.length}`, 14, 62);
  doc.text(`Total Booked Sales: ${formatCurrency(totalSales)}`, 14, 68);
  doc.text(`Total Payments Received: ${formatCurrency(totalReceived)}`, 14, 74);
  doc.text(`Outstanding Amount: ${formatCurrency(totalOutstanding)}`, 14, 80);
  
  const tableData = events.map(e => [
    formatDate(e.date),
    e.title?.substring(0, 25) || '-',
    e.customer?.substring(0, 20) || '-',
    e.planner?.substring(0, 15) || '-',
    e.venue?.substring(0, 20) || '-',
    formatCurrency(Number(e.salesValue || 0)),
    formatCurrency(Number(e.paymentReceived || 0)),
  ]);
  
  autoTable(doc, {
    startY: 88,
    head: [['Date', 'Event', 'Customer', 'Planner', 'Venue', 'Sales', 'Received']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [139, 90, 43], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 220] },
    foot: [['', '', '', '', 'TOTAL', formatCurrency(totalSales), formatCurrency(totalReceived)]],
    footStyles: { fillColor: [139, 90, 43], textColor: 255, fontStyle: 'bold' },
  });
  
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  const filename = `sales-report-${new Date().toISOString().split('T')[0]}.pdf`;
  const documentId = storeDocument(filename, 'application/pdf', pdfBuffer);
  
  return {
    documentId,
    filename,
    message: `Sales report generated with ${events.length} events. Total: ${formatCurrency(totalSales)}`,
  };
}

export async function generateInvoicePdf(options: {
  eventId?: string;
  eventTitle?: string;
}): Promise<{ documentId: string; filename: string; message: string }> {
  let event;
  
  if (options.eventId) {
    event = await storage.getEvent(options.eventId);
  } else if (options.eventTitle) {
    const events = await storage.getAllEvents();
    event = events.find(e => e.title.toLowerCase().includes(options.eventTitle!.toLowerCase()));
  }
  
  if (!event) {
    throw new Error('Event not found');
  }
  
  const doc = new jsPDF();
  
  doc.setFillColor(139, 90, 43);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Oak Street Events', 105, 18, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text('INVOICE', 105, 30, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const invoiceNumber = `INV-${event.id.substring(0, 8).toUpperCase()}`;
  doc.text(`Invoice #: ${invoiceNumber}`, 14, 50);
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 14, 56);
  doc.text(`Event Date: ${formatDate(event.date)}`, 14, 62);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 14, 75);
  doc.setFont('helvetica', 'normal');
  doc.text(event.customer || 'Customer', 14, 81);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Event Details:', 120, 75);
  doc.setFont('helvetica', 'normal');
  doc.text(event.title || 'Event', 120, 81);
  doc.text(`Venue: ${event.venue || 'TBD'}`, 120, 87);
  doc.text(`Planner: ${event.planner || '-'}`, 120, 93);
  
  const salesValue = Number(event.salesValue || 0);
  const paymentReceived = Number(event.paymentReceived || 0);
  const balance = salesValue - paymentReceived;
  
  autoTable(doc, {
    startY: 105,
    head: [['Description', 'Amount']],
    body: [
      ['Event Services', formatCurrency(salesValue)],
    ],
    styles: { fontSize: 10 },
    headStyles: { fillColor: [139, 90, 43] },
    columnStyles: { 1: { halign: 'right' } },
  });
  
  const finalY = (doc as any).lastAutoTable.finalY || 130;
  
  doc.setFont('helvetica', 'bold');
  doc.text('Subtotal:', 130, finalY + 10);
  doc.text(formatCurrency(salesValue), 196, finalY + 10, { align: 'right' });
  
  doc.text('Payments Received:', 130, finalY + 18);
  doc.text(`(${formatCurrency(paymentReceived)})`, 196, finalY + 18, { align: 'right' });
  
  doc.setFillColor(139, 90, 43);
  doc.rect(125, finalY + 22, 71, 10, 'F');
  doc.setTextColor(255, 255, 255);
  doc.text('Balance Due:', 130, finalY + 29);
  doc.text(formatCurrency(balance), 191, finalY + 29, { align: 'right' });
  
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Thank you for choosing Oak Street Events!', 105, 270, { align: 'center' });
  doc.text('For queries, please contact us at events@oakstreet.in', 105, 276, { align: 'center' });
  
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  const filename = `invoice-${invoiceNumber}.pdf`;
  const documentId = storeDocument(filename, 'application/pdf', pdfBuffer);
  
  return {
    documentId,
    filename,
    message: `Invoice generated for ${event.customer}. Total: ${formatCurrency(salesValue)}, Balance: ${formatCurrency(balance)}`,
  };
}

export async function generateQuotePdf(options: {
  customerName: string;
  eventDate: string;
  eventType: string;
  venue: string;
  services: { description: string; amount: number }[];
  notes?: string;
}): Promise<{ documentId: string; filename: string; message: string }> {
  const doc = new jsPDF();
  
  doc.setFillColor(139, 90, 43);
  doc.rect(0, 0, 210, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Oak Street Events', 105, 18, { align: 'center' });
  
  doc.setFontSize(14);
  doc.text('QUOTATION', 105, 30, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  const quoteNumber = `QT-${Date.now().toString().substring(5)}`;
  doc.text(`Quote #: ${quoteNumber}`, 14, 50);
  doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 14, 56);
  doc.text(`Valid Until: ${new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN')}`, 14, 62);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Prepared For:', 14, 75);
  doc.setFont('helvetica', 'normal');
  doc.text(options.customerName, 14, 81);
  
  doc.setFont('helvetica', 'bold');
  doc.text('Event Details:', 120, 75);
  doc.setFont('helvetica', 'normal');
  doc.text(`Type: ${options.eventType}`, 120, 81);
  doc.text(`Date: ${formatDate(options.eventDate)}`, 120, 87);
  doc.text(`Venue: ${options.venue}`, 120, 93);
  
  const tableData = options.services.map(s => [s.description, formatCurrency(s.amount)]);
  const total = options.services.reduce((sum, s) => sum + s.amount, 0);
  
  autoTable(doc, {
    startY: 105,
    head: [['Service Description', 'Amount']],
    body: tableData,
    foot: [['Total', formatCurrency(total)]],
    styles: { fontSize: 10 },
    headStyles: { fillColor: [139, 90, 43] },
    footStyles: { fillColor: [139, 90, 43], textColor: 255, fontStyle: 'bold' },
    columnStyles: { 1: { halign: 'right' } },
  });
  
  if (options.notes) {
    const finalY = (doc as any).lastAutoTable.finalY || 150;
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', 14, finalY + 15);
    doc.setFont('helvetica', 'normal');
    doc.text(options.notes, 14, finalY + 22, { maxWidth: 180 });
  }
  
  doc.setFontSize(9);
  doc.text('Terms & Conditions apply. This quote is valid for 30 days.', 105, 270, { align: 'center' });
  doc.text('Thank you for considering Oak Street Events!', 105, 276, { align: 'center' });
  
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  const filename = `quote-${quoteNumber}.pdf`;
  const documentId = storeDocument(filename, 'application/pdf', pdfBuffer);
  
  return {
    documentId,
    filename,
    message: `Quote generated for ${options.customerName}. Total: ${formatCurrency(total)}`,
  };
}

export async function generateFinancialReportExcel(options: {
  startDate?: string;
  endDate?: string;
  includeEvents?: boolean;
  includeDaybook?: boolean;
}): Promise<{ documentId: string; filename: string; message: string }> {
  const wb = XLSX.utils.book_new();
  
  if (options.includeEvents !== false) {
    let events = await storage.getAllEvents();
    if (options.startDate) events = events.filter(e => e.date >= options.startDate!);
    if (options.endDate) events = events.filter(e => e.date <= options.endDate!);
    
    const eventData = events.map(e => ({
      'Date': e.date,
      'Event Title': e.title,
      'Customer': e.customer,
      'Venue': e.venue,
      'Planner': e.planner,
      'Type': e.type,
      'Sales Value': Number(e.salesValue || 0),
      'Payment Received': Number(e.paymentReceived || 0),
      'Cost': Number(e.cost || 0),
      'Outstanding': Number(e.salesValue || 0) - Number(e.paymentReceived || 0),
      'Profit': Number(e.paymentReceived || 0) - Number(e.cost || 0),
    }));
    
    const wsEvents = XLSX.utils.json_to_sheet(eventData);
    XLSX.utils.book_append_sheet(wb, wsEvents, 'Events');
    
    const totalSales = events.reduce((sum, e) => sum + Number(e.salesValue || 0), 0);
    const totalReceived = events.reduce((sum, e) => sum + Number(e.paymentReceived || 0), 0);
    const totalCost = events.reduce((sum, e) => sum + Number(e.cost || 0), 0);
    
    const summaryData = [
      { 'Metric': 'Total Events', 'Value': events.length },
      { 'Metric': 'Total Booked Sales', 'Value': totalSales },
      { 'Metric': 'Total Payments Received', 'Value': totalReceived },
      { 'Metric': 'Total Costs', 'Value': totalCost },
      { 'Metric': 'Outstanding Amount', 'Value': totalSales - totalReceived },
      { 'Metric': 'Gross Profit', 'Value': totalReceived - totalCost },
    ];
    
    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  }
  
  if (options.includeDaybook !== false) {
    let entries = await storage.getAllDaybookEntries();
    if (options.startDate) entries = entries.filter(e => e.date >= options.startDate!);
    if (options.endDate) entries = entries.filter(e => e.date <= options.endDate!);
    
    const daybookData = entries.map(e => ({
      'Date': e.date,
      'Description': e.description,
      'Type': e.type,
      'Category': e.category,
      'Amount': Number(e.amount || 0),
      'Event': e.eventName || '',
      'Vendor': e.vendorName || '',
    }));
    
    const wsDaybook = XLSX.utils.json_to_sheet(daybookData);
    XLSX.utils.book_append_sheet(wb, wsDaybook, 'Daybook');
    
    const totalIncome = entries.filter(e => e.type === 'income').reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalExpense = entries.filter(e => e.type === 'expense').reduce((sum, e) => sum + Number(e.amount || 0), 0);
    
    const daybookSummary = [
      { 'Metric': 'Total Entries', 'Value': entries.length },
      { 'Metric': 'Total Income', 'Value': totalIncome },
      { 'Metric': 'Total Expense', 'Value': totalExpense },
      { 'Metric': 'Net Balance', 'Value': totalIncome - totalExpense },
    ];
    
    const wsDaybookSummary = XLSX.utils.json_to_sheet(daybookSummary);
    XLSX.utils.book_append_sheet(wb, wsDaybookSummary, 'Daybook Summary');
  }
  
  const excelBuffer = Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  const filename = `financial-report-${new Date().toISOString().split('T')[0]}.xlsx`;
  const documentId = storeDocument(filename, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', excelBuffer);
  
  return {
    documentId,
    filename,
    message: `Financial report generated in Excel format`,
  };
}

export async function generateEmployeeReportPdf(): Promise<{ documentId: string; filename: string; message: string }> {
  const employees = await storage.getAllEmployees();
  
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Oak Street Events', 105, 20, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('Employee Report', 105, 30, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 105, 38, { align: 'center' });
  doc.text(`Total Employees: ${employees.length}`, 105, 45, { align: 'center' });
  
  const tableData = employees.map(e => [
    e.employeeId || '-',
    e.name,
    e.department || '-',
    e.designation || '-',
    e.phone || '-',
    e.email || '-',
  ]);
  
  autoTable(doc, {
    startY: 55,
    head: [['ID', 'Name', 'Department', 'Designation', 'Phone', 'Email']],
    body: tableData,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [139, 90, 43], textColor: 255 },
    alternateRowStyles: { fillColor: [245, 245, 220] },
  });
  
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));
  const filename = `employee-report-${new Date().toISOString().split('T')[0]}.pdf`;
  const documentId = storeDocument(filename, 'application/pdf', pdfBuffer);
  
  return {
    documentId,
    filename,
    message: `Employee report generated with ${employees.length} employees`,
  };
}

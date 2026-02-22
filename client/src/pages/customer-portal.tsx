import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Download, Loader2, FileText, Receipt, AlertCircle } from "lucide-react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import logo from "../assets/atbott-logo.png";

type LineItem = {
  slNo: number;
  type: 'item' | 'section';
  description: string;
  quantity?: number;
  rate?: number;
  taxPercent?: number;
  taxAmount?: number;
  amount?: number;
};

function formatIndianCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function numberToWords(num: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  if (num === 0) return 'Zero';
  
  const convertHundreds = (n: number): string => {
    let str = '';
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += ones[n] + ' ';
    }
    return str;
  };
  
  let result = '';
  if (num >= 10000000) {
    result += convertHundreds(Math.floor(num / 10000000)) + 'Crore ';
    num %= 10000000;
  }
  if (num >= 100000) {
    result += convertHundreds(Math.floor(num / 100000)) + 'Lakh ';
    num %= 100000;
  }
  if (num >= 1000) {
    result += convertHundreds(Math.floor(num / 1000)) + 'Thousand ';
    num %= 1000;
  }
  result += convertHundreds(num);
  return result.trim();
}

async function generatePDF(elementId: string, filename: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  const imgWidth = 210;
  const pageHeight = 297;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const pdf = new jsPDF('p', 'mm', 'a4');
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft >= 0) {
    position = heightLeft - imgHeight;
    pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  pdf.save(filename);
}

export default function CustomerPortal() {
  const params = useParams();
  const token = params.token;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    async function fetchDocument() {
      if (!token) {
        setError('Invalid link');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`/api/portal/${token}`);
        if (!response.ok) {
          const errData = await response.json();
          throw new Error(errData.error || 'Failed to load document');
        }
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message || 'Failed to load document');
      } finally {
        setLoading(false);
      }
    }

    fetchDocument();
  }, [token]);

  const handleDownloadPDF = async () => {
    if (!data) return;
    setIsDownloading(true);
    try {
      const docType = data.link.documentType;
      let filename = 'document.pdf';
      if (docType === 'estimate') {
        filename = `Quote-${data.document.number}.pdf`;
      } else if (docType === 'invoice') {
        filename = `Invoice-${data.document.number}.pdf`;
      } else if (docType === 'payment_receipt') {
        filename = `Receipt-${data.document.number}.pdf`;
      }
      await generatePDF('portal-document', filename);
    } catch (err) {
      console.error('Failed to generate PDF:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="p-8 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-destructive mb-2">Document Not Available</h1>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { link, document: doc, customer, companySettings } = data;
  const docType = link.documentType;

  return (
    <div className="min-h-[100dvh] bg-gray-100 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto px-3 sm:px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src={logo} alt={companySettings?.companyName || 'Event Planner'} className="h-10 sm:h-12 w-auto bg-primary p-1.5 sm:p-2 rounded flex-shrink-0" />
            <span className="text-base sm:text-xl font-semibold text-primary truncate">
              {companySettings?.companyName || 'Your Event Planner'}
            </span>
          </div>
          <Button onClick={handleDownloadPDF} disabled={isDownloading} className="min-h-[44px] w-full sm:w-auto">
            {isDownloading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Download className="h-4 w-4 mr-2" />
            )}
            {isDownloading ? 'Generating...' : 'Download PDF'}
          </Button>
        </div>

        <Card className="shadow-lg">
          <CardContent className="p-0">
            {docType === 'estimate' && (
              <EstimateView doc={doc} customer={customer} companySettings={companySettings} />
            )}
            {docType === 'invoice' && (
              <InvoiceView doc={doc} customer={customer} companySettings={companySettings} />
            )}
            {docType === 'payment_receipt' && (
              <PaymentReceiptView doc={doc} customer={customer} companySettings={companySettings} />
            )}
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          This document was shared securely via Oak Customer Portal
        </p>
      </div>
    </div>
  );
}

function EstimateView({ doc, customer, companySettings }: any) {
  const lineItems: LineItem[] = doc.lineItems || [];

  return (
    <div id="portal-document" className="bg-white p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <img src={logo} alt={companySettings?.companyName || 'Event Planner'} className="h-12 sm:h-16 w-auto bg-primary p-1.5 sm:p-2 rounded flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold">{companySettings?.companyName || 'Your Event Planner'}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-line">
              {companySettings?.address || ''}
            </p>
            <p className="text-xs sm:text-sm">{companySettings?.phone || ''}</p>
            <p className="text-xs sm:text-sm break-all">{companySettings?.email || ''}</p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary">Quotation</h2>
          <Badge variant={doc.status === 'accepted' ? 'default' : doc.status === 'expired' ? 'destructive' : 'secondary'} className="mt-2">
            {doc.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Quote No</p>
          <p className="font-medium">: {doc.number}</p>
          <p className="text-sm text-muted-foreground mt-2">Date</p>
          <p className="font-medium">: {format(new Date(doc.date), 'dd/MM/yyyy')}</p>
          {doc.validUntil && (
            <>
              <p className="text-sm text-muted-foreground mt-2">Valid Until</p>
              <p className="font-medium">: {format(new Date(doc.validUntil), 'dd/MM/yyyy')}</p>
            </>
          )}
          {doc.weddingPlannerName && (
            <>
              <p className="text-sm text-muted-foreground mt-2">Wedding Planner</p>
              <p className="font-medium">: {doc.weddingPlannerName}</p>
            </>
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Bill To</p>
          <p className="font-medium">{customer?.name || '—'}</p>
          <p className="text-sm whitespace-pre-line">{doc.customerAddress || customer?.billingAddress || ''}</p>
        </div>
      </div>

      {doc.subject && (
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">Subject:</p>
          <p className="font-medium">{doc.subject}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="border-y">
              <th className="text-left p-2 w-12">#</th>
              <th className="text-left p-2">Item & Description</th>
              <th className="text-right p-2">Qty</th>
              <th className="text-right p-2">Rate</th>
              <th className="text-right p-2">Tax %</th>
              <th className="text-right p-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => (
              item.type === 'section' ? (
                <tr key={index} className="bg-muted/30">
                  <td colSpan={6} className="p-2 font-semibold">{item.description}</td>
                </tr>
              ) : (
                <tr key={index} className="border-b">
                  <td className="p-2">{item.slNo}</td>
                  <td className="p-2">{item.description}</td>
                  <td className="p-2 text-right">{item.quantity || 0}</td>
                  <td className="p-2 text-right">{formatIndianCurrency(item.rate || 0)}</td>
                  <td className="p-2 text-right">{item.taxPercent || 0}%</td>
                  <td className="p-2 text-right">{formatIndianCurrency(item.amount || 0)}</td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-full sm:w-64 space-y-2">
          <div className="flex justify-between">
            <span>Sub Total</span>
            <span>{formatIndianCurrency(parseFloat(doc.subtotal))}</span>
          </div>
          {parseFloat(doc.taxTotal) > 0 && (
            <div className="flex justify-between">
              <span>Tax Total</span>
              <span>{formatIndianCurrency(parseFloat(doc.taxTotal))}</span>
            </div>
          )}
          {parseFloat(doc.discountAmount) > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Discount ({doc.discountPercent}%)</span>
              <span>-{formatIndianCurrency(parseFloat(doc.discountAmount))}</span>
            </div>
          )}
          {parseFloat(doc.serviceChargeAmount) > 0 && (
            <div className="flex justify-between">
              <span>Service Charge</span>
              <span>{formatIndianCurrency(parseFloat(doc.serviceChargeAmount))}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>{formatIndianCurrency(parseFloat(doc.total))}</span>
          </div>
        </div>
      </div>

      {doc.totalInWords && (
        <p className="text-sm italic mt-4">
          Total in words: Indian Rupee {doc.totalInWords} Only
        </p>
      )}

      {doc.notes && (
        <div className="mt-6">
          <p className="text-sm font-medium">Notes:</p>
          <p className="text-sm whitespace-pre-line">{doc.notes}</p>
        </div>
      )}

      {doc.terms && (
        <div className="mt-4">
          <p className="text-sm font-medium">Terms & Conditions:</p>
          <p className="text-sm whitespace-pre-line">{doc.terms}</p>
        </div>
      )}

      {doc.thankYouMessage && (
        <p className="text-sm italic mt-6">{doc.thankYouMessage}</p>
      )}

      <div className="mt-8 text-right">
        <p className="text-sm text-muted-foreground">Authorized Signature</p>
        {doc.signature && (
          <img src={doc.signature} alt="Signature" className="h-16 ml-auto" />
        )}
      </div>
    </div>
  );
}

function InvoiceView({ doc, customer, companySettings }: any) {
  const lineItems: LineItem[] = doc.lineItems || [];

  return (
    <div id="portal-document" className="bg-white p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <img src={logo} alt={companySettings?.companyName || 'Event Planner'} className="h-12 sm:h-16 w-auto bg-primary p-1.5 sm:p-2 rounded flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold">{companySettings?.companyName || 'Your Event Planner'}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-line">
              {companySettings?.address || ''}
            </p>
            <p className="text-xs sm:text-sm">{companySettings?.phone || ''}</p>
            <p className="text-xs sm:text-sm break-all">{companySettings?.email || ''}</p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <h2 className="text-2xl sm:text-3xl font-bold text-primary">Invoice</h2>
          <Badge variant={doc.status === 'paid' ? 'default' : parseFloat(doc.balanceDue) > 0 ? 'destructive' : 'secondary'} className="mt-2">
            {doc.status}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <p className="text-sm text-muted-foreground">Invoice No</p>
          <p className="font-medium">: {doc.number}</p>
          <p className="text-sm text-muted-foreground mt-2">Invoice Date</p>
          <p className="font-medium">: {format(new Date(doc.date), 'dd/MM/yyyy')}</p>
          {doc.dueDate && (
            <>
              <p className="text-sm text-muted-foreground mt-2">Due Date</p>
              <p className="font-medium">: {format(new Date(doc.dueDate), 'dd/MM/yyyy')}</p>
            </>
          )}
          {doc.weddingPlannerName && (
            <>
              <p className="text-sm text-muted-foreground mt-2">Wedding Planner</p>
              <p className="font-medium">: {doc.weddingPlannerName}</p>
            </>
          )}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Bill To</p>
          <p className="font-medium">{customer?.name || '—'}</p>
          <p className="text-sm whitespace-pre-line">{doc.customerAddress || customer?.billingAddress || ''}</p>
        </div>
      </div>

      {doc.subject && (
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">Subject:</p>
          <p className="font-medium">{doc.subject}</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="border-y">
              <th className="text-left p-2 w-12">#</th>
              <th className="text-left p-2">Item & Description</th>
              <th className="text-right p-2">Qty</th>
              <th className="text-right p-2">Rate</th>
              <th className="text-right p-2">Tax %</th>
              <th className="text-right p-2">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => (
              item.type === 'section' ? (
                <tr key={index} className="bg-muted/30">
                  <td colSpan={6} className="p-2 font-semibold">{item.description}</td>
                </tr>
              ) : (
                <tr key={index} className="border-b">
                  <td className="p-2">{item.slNo}</td>
                  <td className="p-2">{item.description}</td>
                  <td className="p-2 text-right">{item.quantity || 0}</td>
                  <td className="p-2 text-right">{formatIndianCurrency(item.rate || 0)}</td>
                  <td className="p-2 text-right">{item.taxPercent || 0}%</td>
                  <td className="p-2 text-right">{formatIndianCurrency(item.amount || 0)}</td>
                </tr>
              )
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end">
        <div className="w-full sm:w-64 space-y-2">
          <div className="flex justify-between">
            <span>Sub Total</span>
            <span>{formatIndianCurrency(parseFloat(doc.subtotal))}</span>
          </div>
          {parseFloat(doc.taxTotal) > 0 && (
            <div className="flex justify-between">
              <span>Tax Total</span>
              <span>{formatIndianCurrency(parseFloat(doc.taxTotal))}</span>
            </div>
          )}
          {parseFloat(doc.discountAmount) > 0 && (
            <div className="flex justify-between text-destructive">
              <span>Discount ({doc.discountPercent}%)</span>
              <span>-{formatIndianCurrency(parseFloat(doc.discountAmount))}</span>
            </div>
          )}
          {parseFloat(doc.serviceChargeAmount) > 0 && (
            <div className="flex justify-between">
              <span>Service Charge</span>
              <span>{formatIndianCurrency(parseFloat(doc.serviceChargeAmount))}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-lg">
            <span>Total</span>
            <span>{formatIndianCurrency(parseFloat(doc.total))}</span>
          </div>
          <div className="flex justify-between font-bold text-destructive">
            <span>Balance Due</span>
            <span>{formatIndianCurrency(parseFloat(doc.balanceDue))}</span>
          </div>
        </div>
      </div>

      {doc.totalInWords && (
        <p className="text-sm italic mt-4">
          Total in words: Indian Rupee {doc.totalInWords} Only
        </p>
      )}

      {doc.notes && (
        <div className="mt-6">
          <p className="text-sm font-medium">Notes:</p>
          <p className="text-sm whitespace-pre-line">{doc.notes}</p>
        </div>
      )}

      {doc.terms && (
        <div className="mt-4">
          <p className="text-sm font-medium">Terms & Conditions:</p>
          <p className="text-sm whitespace-pre-line">{doc.terms}</p>
        </div>
      )}

      {doc.thankYouMessage && (
        <p className="text-sm italic mt-6">{doc.thankYouMessage}</p>
      )}

      <div className="mt-8 text-right">
        <p className="text-sm text-muted-foreground">Authorized Signature</p>
        {doc.signature && (
          <img src={doc.signature} alt="Signature" className="h-16 ml-auto" />
        )}
      </div>
    </div>
  );
}

function PaymentReceiptView({ doc, customer, companySettings }: any) {
  return (
    <div id="portal-document" className="bg-white p-4 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <img src={logo} alt={companySettings?.companyName || 'Event Planner'} className="h-12 sm:h-16 w-auto bg-primary p-1.5 sm:p-2 rounded flex-shrink-0" />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold">{companySettings?.companyName || 'Your Event Planner'}</h1>
            <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-line">
              {companySettings?.address || ''}
            </p>
            <p className="text-xs sm:text-sm">{companySettings?.phone || ''}</p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <h2 className="text-xl sm:text-3xl font-bold text-green-600">Payment Receipt</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div className="space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">Receipt No</p>
            <p className="font-medium">{doc.number}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Date</p>
            <p className="font-medium">{format(new Date(doc.date), 'dd/MM/yyyy')}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Payment Mode</p>
            <p className="font-medium capitalize">{doc.paymentMode.replace('_', ' ')}</p>
          </div>
          {doc.reference && (
            <div>
              <p className="text-sm text-muted-foreground">Reference</p>
              <p className="font-medium">{doc.reference}</p>
            </div>
          )}
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">Received From</p>
            <p className="font-medium">{customer?.name || '—'}</p>
          </div>
        </div>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 text-center">
        <p className="text-sm text-muted-foreground mb-2">Amount Received</p>
        <p className="text-4xl font-bold text-green-600">{formatIndianCurrency(parseFloat(doc.amount))}</p>
        <p className="text-sm mt-2 italic">Indian Rupee {numberToWords(Math.round(parseFloat(doc.amount)))} Only</p>
      </div>

      {doc.notes && (
        <div className="mb-6">
          <p className="text-sm text-muted-foreground">Notes</p>
          <p className="text-sm">{doc.notes}</p>
        </div>
      )}

      <div className="flex justify-between items-end mt-8">
        <div>
          <p className="text-sm text-muted-foreground">Thank you for your payment!</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Authorized Signature</p>
          <div className="h-16 w-32 border-b border-gray-300 mt-8"></div>
        </div>
      </div>
    </div>
  );
}

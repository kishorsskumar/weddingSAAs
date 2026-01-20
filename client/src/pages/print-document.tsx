import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { format } from "date-fns";
import logo from "@assets/OAK_1_1766646679471.jpg";
import yepmanLogo from "@assets/Yepman_1767319118647.png";

// Brand colors
const BRAND_COLOR = '#6b9937';  // Oakstreet brand color
const YEPMAN_BRAND_COLOR = '#9d2966';  // Yepman brand color (maroon/magenta)

interface LineItem {
  slNo?: number;
  name: string;
  description?: string;
  hsnCode?: string;
  quantity: number;
  rate: number;
  total: number;
  taxRate?: number;
  cgstPercent?: number;
  cgstAmount?: number;
  sgstPercent?: number;
  sgstAmount?: number;
  isHeading?: boolean;
}

interface DocumentData {
  estimate?: any;
  invoice?: any;
  payment?: any;
  customer?: any;
  bank?: any;
  companySettings?: any;
  checklist?: any;
  event?: any;
  plan?: any;
  deliveryChallan?: any;
}

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function numberToWords(num: number): string {
  if (num === 0) return 'Zero';
  if (num < 0) return 'Negative ' + numberToWords(-num);

  let words = '';

  if (num >= 10000000) {
    words += numberToWords(Math.floor(num / 10000000)) + ' Crore ';
    num %= 10000000;
  }

  if (num >= 100000) {
    words += numberToWords(Math.floor(num / 100000)) + ' Lakh ';
    num %= 100000;
  }

  if (num >= 1000) {
    words += numberToWords(Math.floor(num / 1000)) + ' Thousand ';
    num %= 1000;
  }

  if (num >= 100) {
    words += numberToWords(Math.floor(num / 100)) + ' Hundred ';
    num %= 100;
  }

  if (num > 0) {
    if (num < 20) {
      words += ones[num];
    } else {
      words += tens[Math.floor(num / 10)];
      if (num % 10 > 0) {
        words += ' ' + ones[num % 10];
      }
    }
  }

  return words.trim();
}

function formatIndianCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return formatted;
}

export default function PrintDocument() {
  const params = useParams<{ type: string; id: string }>();
  const [data, setData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Check for noHeader query parameter
  const searchParams = new URLSearchParams(window.location.search);
  const hideHeader = searchParams.get('noHeader') === 'true';

  useEffect(() => {
    async function fetchData() {
      try {
        const type = params.type;
        const id = params.id;

        const [settingsRes] = await Promise.all([
          fetch('/api/company-settings'),
        ]);
        const companySettings = await settingsRes.json();

        let docData: DocumentData = { companySettings };

        if (type === 'quote') {
          const [estimateRes, customersRes] = await Promise.all([
            fetch(`/api/estimates/${id}`),
            fetch('/api/customers'),
          ]);
          const estimate = await estimateRes.json();
          const customers = await customersRes.json();
          docData.estimate = estimate;
          docData.customer = customers.find((c: any) => c.id === estimate.customerId);
        } else if (type === 'invoice') {
          const [invoiceRes, customersRes] = await Promise.all([
            fetch(`/api/invoices/${id}`),
            fetch('/api/customers'),
          ]);
          const invoice = await invoiceRes.json();
          const customers = await customersRes.json();
          docData.invoice = invoice;
          docData.customer = customers.find((c: any) => c.id === invoice.customerId);
        } else if (type === 'receipt') {
          const [paymentsRes, customersRes, invoicesRes, banksRes] = await Promise.all([
            fetch('/api/customer-payments'),
            fetch('/api/customers'),
            fetch('/api/invoices'),
            fetch('/api/banks'),
          ]);
          const payments = await paymentsRes.json();
          const customers = await customersRes.json();
          const invoices = await invoicesRes.json();
          const banks = await banksRes.json();
          const payment = payments.find((p: any) => p.id === id);
          if (payment) {
            docData.payment = payment;
            docData.customer = customers.find((c: any) => c.id === payment.customerId);
            docData.invoice = invoices.find((i: any) => i.id === payment.invoiceId);
            docData.bank = banks.find((b: any) => b.id === payment.bankId);
          }
        } else if (type === 'checklist') {
          const [planRes, checklistRes, eventsRes] = await Promise.all([
            fetch(`/api/execution-plans`),
            fetch(`/api/execution-plans/${id}/checklist`),
            fetch('/api/events'),
          ]);
          const plans = await planRes.json();
          const checklist = await checklistRes.json();
          const events = await eventsRes.json();
          const plan = plans.find((p: any) => p.id === id);
          if (plan) {
            docData.plan = plan;
            docData.checklist = checklist;
            docData.event = events.find((e: any) => e.id === plan.eventId);
          }
        } else if (type === 'delivery-challan') {
          const challanRes = await fetch(`/api/delivery-challans/${id}`);
          const deliveryChallan = await challanRes.json();
          docData.deliveryChallan = deliveryChallan;
        }

        setData(docData);
        setLoading(false);

        setTimeout(() => {
          (window as any).printReady = true;
        }, 500);
      } catch (err) {
        setError(String(err));
        setLoading(false);
      }
    }

    fetchData();
  }, [params.type, params.id]);

  if (loading) {
    return <div className="p-8 text-center">Loading...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-600">Error: {error}</div>;
  }

  const { estimate, invoice, payment, customer, bank, companySettings } = data!;

  if (params.type === 'quote' && estimate) {
    return <QuotePrint estimate={estimate} customer={customer} companySettings={companySettings} hideHeader={hideHeader} />;
  }

  if (params.type === 'invoice' && invoice) {
    return <InvoicePrint invoice={invoice} customer={customer} companySettings={companySettings} hideHeader={hideHeader} />;
  }

  if (params.type === 'receipt' && payment) {
    return <ReceiptPrint payment={payment} customer={customer} invoice={invoice} bank={bank} companySettings={companySettings} hideHeader={hideHeader} />;
  }

  if (params.type === 'checklist' && data?.checklist) {
    return <ChecklistPrint checklist={data.checklist} plan={data.plan} event={data.event} companySettings={companySettings} />;
  }

  if (params.type === 'delivery-challan' && data?.deliveryChallan) {
    return <DeliveryChallanPrint challan={data.deliveryChallan} companySettings={companySettings} hideHeader={hideHeader} />;
  }

  return <div className="p-8 text-center">Document not found</div>;
}

const baseStyles = `
  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @page { size: A4; margin: 15mm 10mm; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #333; line-height: 1.4; }
  
  .document { max-width: 800px; margin: 0 auto; padding: 20px; background: white; }
  
  /* Header */
  .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
  .company-info { flex: 1; }
  .company-logo { width: 180px; height: auto; background: white; padding: 4px; border-radius: 4px; margin-bottom: 8px; }
  .company-logo img { width: 100%; height: auto; max-height: 80px; object-fit: contain; }
  .company-name { display: none; }
  .company-address { font-size: 11px; color: #444; line-height: 1.5; }
  .doc-type-box { text-align: right; }
  .doc-type { font-size: 28px; font-weight: bold; color: #6b9937; }
  
  /* Document Info */
  .doc-info { margin-bottom: 15px; }
  .doc-info-row { display: flex; margin-bottom: 3px; }
  .doc-info-label { min-width: 120px; font-weight: 500; }
  .doc-info-value { }
  
  /* Bill To */
  .bill-to-section { margin-bottom: 15px; }
  .bill-to-label { font-weight: bold; margin-bottom: 5px; color: #333; }
  .bill-to-content { line-height: 1.5; }
  .customer-name { font-weight: bold; }
  
  /* Subject */
  .subject-section { margin-bottom: 15px; padding: 8px 0; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; }
  .subject-label { font-weight: bold; margin-bottom: 3px; }
  .subject-text { }
  
  /* Items Table */
  .items-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10px; }
  .items-table th { background: #f5f5f5; padding: 8px 6px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
  .items-table th.text-right { text-align: right; }
  .items-table th.text-center { text-align: center; }
  .items-table td { padding: 6px; border-bottom: 1px solid #eee; vertical-align: top; }
  .items-table td.text-right { text-align: right; }
  .items-table td.text-center { text-align: center; }
  .items-table .heading-row td { background: #f9f9f9; font-weight: bold; padding: 8px 6px; }
  .items-table .item-name { font-weight: 500; }
  .items-table .item-desc { color: #666; font-size: 9px; white-space: pre-line; margin-top: 2px; }
  .items-table .sl-no { width: 35px; text-align: center; }
  .items-table .qty-col { width: 50px; text-align: right; }
  .items-table .rate-col { width: 80px; text-align: right; }
  .items-table .amount-col { width: 90px; text-align: right; }
  
  /* Totals */
  .totals-section { display: flex; justify-content: flex-end; margin-bottom: 15px; }
  .totals-table { width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee; }
  .totals-row.total-row { font-weight: bold; font-size: 13px; border-top: 2px solid #6b9937; border-bottom: none; padding-top: 8px; margin-top: 5px; }
  .totals-label { }
  .totals-value { text-align: right; min-width: 100px; }
  
  /* Amount in Words */
  .amount-words { margin-bottom: 15px; }
  .amount-words-label { font-weight: bold; margin-bottom: 3px; }
  .amount-words-text { font-style: italic; }
  
  /* Notes */
  .notes-section { margin-bottom: 15px; }
  .notes-label { font-weight: bold; margin-bottom: 5px; }
  .notes-text { color: #555; }
  
  /* Terms */
  .terms-section { margin-bottom: 20px; }
  .terms-label { font-weight: bold; margin-bottom: 5px; }
  .terms-list { list-style: none; padding: 0; }
  .terms-list li { margin-bottom: 3px; color: #555; font-size: 10px; }
  
  /* Signature */
  .signature-section { display: flex; justify-content: flex-end; margin-top: 30px; }
  .signature-box { text-align: center; width: 180px; }
  .signature-line { border-top: 1px solid #333; padding-top: 8px; margin-top: 50px; font-size: 11px; }
  
  /* Footer */
  .footer { text-align: center; margin-top: 20px; padding-top: 10px; border-top: 1px solid #eee; font-size: 9px; color: #888; }
`;

function QuotePrint({ estimate, customer, companySettings, hideHeader }: any) {
  const rawLineItems: LineItem[] = estimate.lineItems || [];
  const isTaxDocument = estimate.isTaxDocument === true;
  
  // Calculate serial numbers for non-heading items
  let slNoCounter = 0;
  const lineItems = rawLineItems.map(item => {
    if (item.isHeading) {
      return item;
    }
    slNoCounter++;
    return { ...item, slNo: slNoCounter };
  });
  
  // Use olive green for all documents
  const quoteStyles = baseStyles;

  // Calculate CGST and SGST totals for tax documents
  const cgstTotal = isTaxDocument ? lineItems.filter(i => !i.isHeading).reduce((sum, item) => sum + (item.cgstAmount || 0), 0) : 0;
  const sgstTotal = isTaxDocument ? lineItems.filter(i => !i.isHeading).reduce((sum, item) => sum + (item.sgstAmount || 0), 0) : 0;

  return (
    <div className="document">
      <style>{quoteStyles}</style>

      {/* Header */}
      <div className="header">
        {!hideHeader && (
          <div className="company-info">
            <div className="company-logo">
              <img src={isTaxDocument ? yepmanLogo : logo} alt="Logo" />
            </div>
            <div className="company-name" style={{ color: isTaxDocument ? '#9d2966' : '#6b9937' }}>
              {isTaxDocument ? 'Yepman International' : (companySettings?.companyName || 'Oakstreet Events')}
            </div>
            <div className="company-address">
              {(companySettings?.address || '2nd Floor, Above Devas Studio\nDeshabhimani press road\nKochi Kerala 682017\nIndia').split('\n').map((line: string, i: number) => (
                <div key={i}>{line}</div>
              ))}
              {isTaxDocument && <div style={{ fontWeight: 'bold' }}>GSTIN: {companySettings?.gstin || '32AALCS5678K1Z5'}</div>}
            </div>
          </div>
        )}
        {hideHeader && <div className="company-info" />}
        <div className="doc-type-box">
          <div className="doc-type" style={{ color: isTaxDocument ? '#9d2966' : '#6b9937' }}>{isTaxDocument ? 'TAX ESTIMATE' : 'Quote'}</div>
        </div>
      </div>

      {/* Document Info */}
      <div className="doc-info">
        <div className="doc-info-row">
          <span className="doc-info-label">Estimate No</span>
          <span>: {estimate.number}</span>
        </div>
        <div className="doc-info-row">
          <span className="doc-info-label">{isTaxDocument ? 'Estimate Date' : 'Quote Date'}</span>
          <span>: {format(new Date(estimate.date), 'dd/MM/yyyy')}</span>
        </div>
        {isTaxDocument && estimate.placeOfSupply && (
          <div className="doc-info-row">
            <span className="doc-info-label">Place of Supply</span>
            <span>: {estimate.placeOfSupply}</span>
          </div>
        )}
      </div>

      {/* Bill To */}
      <div className="bill-to-section">
        <div className="bill-to-label">Bill To</div>
        <div className="bill-to-content">
          <div className="customer-name">{customer?.name || '—'}</div>
          {(estimate.customerAddress || customer?.billingAddress || '').split('\n').map((line: string, i: number) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>

      {/* Subject */}
      {estimate.subject && (
        <div className="subject-section">
          <span className="subject-label">Subject : </span>
          <span className="subject-text">{estimate.subject}</span>
        </div>
      )}

      {/* Items Table */}
      {isTaxDocument ? (
        <table className="items-table" style={{ fontSize: '9px' }}>
          <thead>
            <tr>
              <th style={{ width: '30px' }}>#</th>
              <th>Item & Description</th>
              <th style={{ width: '60px' }}>HSN/SAC</th>
              <th style={{ width: '45px', textAlign: 'right' }}>Qty</th>
              <th style={{ width: '60px', textAlign: 'right' }}>Rate</th>
              <th style={{ width: '35px', textAlign: 'center' }}>CGST%</th>
              <th style={{ width: '55px', textAlign: 'right' }}>CGST</th>
              <th style={{ width: '35px', textAlign: 'center' }}>SGST%</th>
              <th style={{ width: '55px', textAlign: 'right' }}>SGST</th>
              <th style={{ width: '70px', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => {
              if (item.isHeading) {
                return (
                  <tr key={index} className="heading-row">
                    <td colSpan={10} style={{ fontWeight: 'bold' }}>{item.name}</td>
                  </tr>
                );
              }
              return (
                <tr key={index}>
                  <td style={{ textAlign: 'center' }}>{item.slNo}</td>
                  <td>
                    <div className="item-name">{item.name}</div>
                    {item.description && <div className="item-desc">{item.description}</div>}
                  </td>
                  <td style={{ textAlign: 'center' }}>{(item as any).hsnSac || ''}</td>
                  <td style={{ textAlign: 'right' }}>{item.quantity.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>{formatIndianCurrency(item.rate)}</td>
                  <td style={{ textAlign: 'center' }}>{item.cgstPercent || 0}%</td>
                  <td style={{ textAlign: 'right' }}>{formatIndianCurrency(item.cgstAmount || 0)}</td>
                  <td style={{ textAlign: 'center' }}>{item.sgstPercent || 0}%</td>
                  <td style={{ textAlign: 'right' }}>{formatIndianCurrency(item.sgstAmount || 0)}</td>
                  <td style={{ textAlign: 'right' }}>{formatIndianCurrency(item.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <table className="items-table">
          <thead>
            <tr>
              <th className="sl-no">Sl<br/>No</th>
              <th>Item & Description</th>
              <th className="qty-col">Qty</th>
              <th className="rate-col">Rate</th>
              <th className="amount-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => {
              if (item.isHeading) {
                return (
                  <tr key={index} className="heading-row">
                    <td colSpan={5} style={{ fontWeight: 'bold' }}>{item.name}</td>
                  </tr>
                );
              }
              return (
                <tr key={index}>
                  <td className="sl-no">{item.slNo}</td>
                  <td>
                    <div className="item-name">{item.name}</div>
                    {item.description && <div className="item-desc">{item.description}</div>}
                  </td>
                  <td className="qty-col">{item.quantity.toFixed(2)}</td>
                  <td className="rate-col">{formatIndianCurrency(item.rate)}</td>
                  <td className="amount-col">{formatIndianCurrency(item.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Totals */}
      <div className="totals-section">
        <div className="totals-table">
          <div className="totals-row">
            <span className="totals-label">Sub Total</span>
            <span className="totals-value">{formatIndianCurrency(parseFloat(estimate.subtotal || estimate.total))}</span>
          </div>
          {isTaxDocument ? (
            <>
              {cgstTotal > 0 && (
                <div className="totals-row">
                  <span className="totals-label">CGST</span>
                  <span className="totals-value">{formatIndianCurrency(cgstTotal)}</span>
                </div>
              )}
              {sgstTotal > 0 && (
                <div className="totals-row">
                  <span className="totals-label">SGST</span>
                  <span className="totals-value">{formatIndianCurrency(sgstTotal)}</span>
                </div>
              )}
            </>
          ) : (
            <>
              {parseFloat(estimate.discountPercent) > 0 && (
                <div className="totals-row" style={{ color: '#dc2626' }}>
                  <span className="totals-label">Discount ({estimate.discountPercent}%)</span>
                  <span className="totals-value">-{formatIndianCurrency(parseFloat(estimate.discountAmount))}</span>
                </div>
              )}
              {parseFloat(estimate.serviceChargePercent) > 0 && (
                <div className="totals-row">
                  <span className="totals-label">Service Charge</span>
                  <span className="totals-value">{formatIndianCurrency(parseFloat(estimate.serviceChargeAmount))}</span>
                </div>
              )}
            </>
          )}
          <div className="totals-row total-row">
            <span className="totals-label">Total</span>
            <span className="totals-value">₹{formatIndianCurrency(parseFloat(estimate.total))}</span>
          </div>
        </div>
      </div>

      {/* Amount in Words */}
      <div className="amount-words">
        <span className="amount-words-label">Total In Words</span>
        <div className="amount-words-text">
          {estimate.totalInWords || `Indian Rupee ${numberToWords(Math.round(parseFloat(estimate.total)))} Only`}
        </div>
      </div>

      {/* Notes */}
      {estimate.notes && (
        <div className="notes-section">
          <div className="notes-label">Notes</div>
          <div className="notes-text">{estimate.notes}</div>
        </div>
      )}

      {/* Terms & Conditions */}
      {estimate.terms && (
        <div className="terms-section">
          <div className="terms-label">Terms & Conditions</div>
          <ol className="terms-list">
            {estimate.terms.split('\n').filter((t: string) => t.trim()).map((term: string, i: number) => {
              const cleanTerm = term.replace(/^\d+\.\s*/, '');
              return <li key={i}>{i + 1}. {cleanTerm}</li>;
            })}
          </ol>
        </div>
      )}

      {/* Signature */}
      <div className="signature-section">
        <div className="signature-box">
          <div className="signature-line">Authorized Signature</div>
        </div>
      </div>

    </div>
  );
}

function InvoicePrint({ invoice, customer, companySettings, hideHeader }: any) {
  const rawLineItems: LineItem[] = invoice.lineItems || [];
  const isTaxDocument = invoice.isTaxDocument === true;

  // Calculate serial numbers for non-heading items
  let slNoCounter = 0;
  const lineItems = rawLineItems.map(item => {
    if (item.isHeading) {
      return item;
    }
    slNoCounter++;
    return { ...item, slNo: slNoCounter };
  });

  // Use olive green for all documents
  const invoiceStyles = baseStyles;

  // Calculate CGST and SGST totals for tax documents
  const cgstTotal = isTaxDocument ? lineItems.filter(i => !i.isHeading).reduce((sum, item) => sum + (item.cgstAmount || 0), 0) : 0;
  const sgstTotal = isTaxDocument ? lineItems.filter(i => !i.isHeading).reduce((sum, item) => sum + (item.sgstAmount || 0), 0) : 0;

  return (
    <div className="document">
      <style>{invoiceStyles}</style>

      {/* Header */}
      <div className="header">
        {!hideHeader && (
          <div className="company-info">
            <div className="company-logo">
              <img src={isTaxDocument ? yepmanLogo : logo} alt="Logo" />
            </div>
            <div className="company-name" style={{ color: isTaxDocument ? '#9d2966' : '#6b9937' }}>
              {isTaxDocument ? 'Yepman International' : (companySettings?.companyName || 'Oakstreet Events')}
            </div>
            <div className="company-address">
              {(companySettings?.address || '2nd Floor, Above Devas Studio\nDeshabhimani press road\nKochi Kerala 682017\nIndia').split('\n').map((line: string, i: number) => (
                <div key={i}>{line}</div>
              ))}
              {isTaxDocument && <div style={{ fontWeight: 'bold' }}>GSTIN: {companySettings?.gstin || '32AALCS5678K1Z5'}</div>}
            </div>
          </div>
        )}
        {hideHeader && <div className="company-info" />}
        <div className="doc-type-box">
          <div className="doc-type" style={{ color: isTaxDocument ? '#9d2966' : '#6b9937' }}>{isTaxDocument ? 'TAX INVOICE' : 'Invoice'}</div>
        </div>
      </div>

      {/* Document Info */}
      <div className="doc-info">
        <div className="doc-info-row">
          <span className="doc-info-label">Invoice No</span>
          <span>: {invoice.number}</span>
        </div>
        <div className="doc-info-row">
          <span className="doc-info-label">Invoice Date</span>
          <span>: {format(new Date(invoice.date), 'dd/MM/yyyy')}</span>
        </div>
        {invoice.dueDate && (
          <div className="doc-info-row">
            <span className="doc-info-label">Due Date</span>
            <span>: {format(new Date(invoice.dueDate), 'dd/MM/yyyy')}</span>
          </div>
        )}
        {isTaxDocument && invoice.placeOfSupply && (
          <div className="doc-info-row">
            <span className="doc-info-label">Place of Supply</span>
            <span>: {invoice.placeOfSupply}</span>
          </div>
        )}
      </div>

      {/* Bill To */}
      <div className="bill-to-section">
        <div className="bill-to-label">Bill To</div>
        <div className="bill-to-content">
          <div className="customer-name">{customer?.name || '—'}</div>
          {(invoice.customerAddress || customer?.billingAddress || '').split('\n').map((line: string, i: number) => (
            <div key={i}>{line}</div>
          ))}
          {customer?.gstNumber && <div>GSTIN: {customer.gstNumber}</div>}
        </div>
      </div>

      {/* Subject */}
      {invoice.subject && (
        <div className="subject-section">
          <span className="subject-label">Subject : </span>
          <span className="subject-text">{invoice.subject}</span>
        </div>
      )}

      {/* Items Table */}
      {isTaxDocument ? (
        <table className="items-table" style={{ fontSize: '9px' }}>
          <thead>
            <tr>
              <th style={{ width: '30px' }}>#</th>
              <th>Item & Description</th>
              <th style={{ width: '60px' }}>HSN/SAC</th>
              <th style={{ width: '45px', textAlign: 'right' }}>Qty</th>
              <th style={{ width: '60px', textAlign: 'right' }}>Rate</th>
              <th style={{ width: '35px', textAlign: 'center' }}>CGST%</th>
              <th style={{ width: '55px', textAlign: 'right' }}>CGST</th>
              <th style={{ width: '35px', textAlign: 'center' }}>SGST%</th>
              <th style={{ width: '55px', textAlign: 'right' }}>SGST</th>
              <th style={{ width: '70px', textAlign: 'right' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => {
              if (item.isHeading) {
                return (
                  <tr key={index} className="heading-row">
                    <td colSpan={10} style={{ fontWeight: 'bold' }}>{item.name}</td>
                  </tr>
                );
              }
              return (
                <tr key={index}>
                  <td style={{ textAlign: 'center' }}>{item.slNo}</td>
                  <td>
                    <div className="item-name">{item.name}</div>
                    {item.description && <div className="item-desc">{item.description}</div>}
                  </td>
                  <td style={{ textAlign: 'center' }}>{(item as any).hsnSac || ''}</td>
                  <td style={{ textAlign: 'right' }}>{item.quantity.toFixed(2)}</td>
                  <td style={{ textAlign: 'right' }}>{formatIndianCurrency(item.rate)}</td>
                  <td style={{ textAlign: 'center' }}>{item.cgstPercent || 0}%</td>
                  <td style={{ textAlign: 'right' }}>{formatIndianCurrency(item.cgstAmount || 0)}</td>
                  <td style={{ textAlign: 'center' }}>{item.sgstPercent || 0}%</td>
                  <td style={{ textAlign: 'right' }}>{formatIndianCurrency(item.sgstAmount || 0)}</td>
                  <td style={{ textAlign: 'right' }}>{formatIndianCurrency(item.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <table className="items-table">
          <thead>
            <tr>
              <th className="sl-no">Sl<br/>No</th>
              <th>Item & Description</th>
              <th className="qty-col">Qty</th>
              <th className="rate-col">Rate</th>
              <th className="amount-col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, index) => {
              if (item.isHeading) {
                return (
                  <tr key={index} className="heading-row">
                    <td colSpan={5} style={{ fontWeight: 'bold' }}>{item.name}</td>
                  </tr>
                );
              }
              return (
                <tr key={index}>
                  <td className="sl-no">{item.slNo}</td>
                  <td>
                    <div className="item-name">{item.name}</div>
                    {item.description && <div className="item-desc">{item.description}</div>}
                  </td>
                  <td className="qty-col">{item.quantity.toFixed(2)}</td>
                  <td className="rate-col">{formatIndianCurrency(item.rate)}</td>
                  <td className="amount-col">{formatIndianCurrency(item.total)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Totals */}
      <div className="totals-section">
        <div className="totals-table">
          <div className="totals-row">
            <span className="totals-label">Sub Total</span>
            <span className="totals-value">{formatIndianCurrency(parseFloat(invoice.subtotal || invoice.total))}</span>
          </div>
          {isTaxDocument ? (
            <>
              {cgstTotal > 0 && (
                <div className="totals-row">
                  <span className="totals-label">CGST</span>
                  <span className="totals-value">{formatIndianCurrency(cgstTotal)}</span>
                </div>
              )}
              {sgstTotal > 0 && (
                <div className="totals-row">
                  <span className="totals-label">SGST</span>
                  <span className="totals-value">{formatIndianCurrency(sgstTotal)}</span>
                </div>
              )}
            </>
          ) : (
            <>
              {parseFloat(invoice.discountPercent) > 0 && (
                <div className="totals-row" style={{ color: '#dc2626' }}>
                  <span className="totals-label">Discount ({invoice.discountPercent}%)</span>
                  <span className="totals-value">-{formatIndianCurrency(parseFloat(invoice.discountAmount))}</span>
                </div>
              )}
              {parseFloat(invoice.serviceChargePercent) > 0 && (
                <div className="totals-row">
                  <span className="totals-label">Service Charge</span>
                  <span className="totals-value">{formatIndianCurrency(parseFloat(invoice.serviceChargeAmount))}</span>
                </div>
              )}
            </>
          )}
          <div className="totals-row total-row" style={{ borderTopColor: '#6b9937' }}>
            <span className="totals-label">Total</span>
            <span className="totals-value">₹{formatIndianCurrency(parseFloat(invoice.total))}</span>
          </div>
          {parseFloat(invoice.amountPaid || 0) > 0 && (
            <div className="totals-row" style={{ color: '#16a34a' }}>
              <span className="totals-label">Amount Paid</span>
              <span className="totals-value">-{formatIndianCurrency(parseFloat(invoice.amountPaid))}</span>
            </div>
          )}
          <div className="totals-row" style={{ fontWeight: 'bold', background: '#f0f9ff', padding: '8px 5px', borderRadius: '4px' }}>
            <span className="totals-label">Balance Due</span>
            <span className="totals-value">₹{formatIndianCurrency(parseFloat(invoice.balanceDue))}</span>
          </div>
        </div>
      </div>

      {/* Amount in Words */}
      <div className="amount-words">
        <span className="amount-words-label">Total In Words</span>
        <div className="amount-words-text">
          {invoice.totalInWords || `Indian Rupee ${numberToWords(Math.round(parseFloat(invoice.total)))} Only`}
        </div>
      </div>

      {/* Bank Details */}
      {(companySettings?.bankName || companySettings?.bankAccountNumber) && (
        <div className="notes-section" style={{ background: '#f8fafc', padding: '10px', borderRadius: '4px' }}>
          <div className="notes-label">Bank Details</div>
          <div style={{ fontSize: '10px', lineHeight: '1.6' }}>
            {companySettings?.bankName && <div>Bank: {companySettings.bankName}</div>}
            {companySettings?.bankAccountNumber && <div>A/C No: {companySettings.bankAccountNumber}</div>}
            {companySettings?.bankIfscCode && <div>IFSC: {companySettings.bankIfscCode}</div>}
            {companySettings?.bankBranch && <div>Branch: {companySettings.bankBranch}</div>}
          </div>
        </div>
      )}

      {/* Notes */}
      {invoice.notes && (
        <div className="notes-section">
          <div className="notes-label">Notes</div>
          <div className="notes-text">{invoice.notes}</div>
        </div>
      )}

      {/* Terms & Conditions */}
      {invoice.terms && (
        <div className="terms-section">
          <div className="terms-label">Terms & Conditions</div>
          <ol className="terms-list">
            {invoice.terms.split('\n').filter((t: string) => t.trim()).map((term: string, i: number) => {
              const cleanTerm = term.replace(/^\d+\.\s*/, '');
              return <li key={i}>{i + 1}. {cleanTerm}</li>;
            })}
          </ol>
        </div>
      )}

      {/* Signature */}
      <div className="signature-section">
        <div className="signature-box">
          <div className="signature-line">Authorized Signature</div>
        </div>
      </div>

    </div>
  );
}

function ReceiptPrint({ payment, customer, invoice, bank, companySettings, hideHeader }: any) {
  // Determine if this is a tax document based on invoice or customer company
  const isTaxDocument = invoice?.isTaxDocument === true || customer?.company === 'yepman';
  const brandColor = isTaxDocument ? YEPMAN_BRAND_COLOR : '#6b9937';
  const companyName = isTaxDocument ? 'Yepman International' : (companySettings?.companyName || 'Oakstreet Events');
  const companyLogo = isTaxDocument ? yepmanLogo : logo;
  
  const receiptStyles = baseStyles;

  return (
    <div className="document">
      <style>{receiptStyles}</style>

      {/* Header */}
      <div className="header">
        {!hideHeader && (
          <div className="company-info">
            <div className="company-logo">
              <img src={companyLogo} alt="Logo" />
            </div>
            <div className="company-name" style={{ color: brandColor }}>{companyName}</div>
            <div className="company-address">
              {(companySettings?.address || '2nd Floor, Above Devas Studio\nDeshabhimani press road\nKochi Kerala 682017\nIndia').split('\n').map((line: string, i: number) => (
                <div key={i}>{line}</div>
              ))}
              {isTaxDocument && <div style={{ fontWeight: 'bold' }}>GSTIN: {companySettings?.gstin || '32AALCS5678K1Z5'}</div>}
            </div>
          </div>
        )}
        {hideHeader && <div className="company-info" />}
        <div className="doc-type-box">
          <div className="doc-type" style={{ color: brandColor }}>Payment Receipt</div>
        </div>
      </div>

      {/* Document Info */}
      <div className="doc-info">
        <div className="doc-info-row">
          <span className="doc-info-label">Receipt No</span>
          <span>: {payment.number}</span>
        </div>
        <div className="doc-info-row">
          <span className="doc-info-label">Date</span>
          <span>: {format(new Date(payment.date), 'dd/MM/yyyy')}</span>
        </div>
        <div className="doc-info-row">
          <span className="doc-info-label">Payment Mode</span>
          <span>: {(payment.paymentMode || '').replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</span>
        </div>
      </div>

      {/* Received From */}
      <div className="bill-to-section">
        <div className="bill-to-label">Received From</div>
        <div className="bill-to-content">
          <div className="customer-name">{customer?.name || '—'}</div>
          {customer?.billingAddress && customer.billingAddress.split('\n').map((line: string, i: number) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      </div>

      {/* Payment Details */}
      <div style={{ 
        margin: '20px 0', 
        padding: '25px', 
        background: isTaxDocument ? '#fdf4f8' : '#f0fdf4', 
        border: `2px solid ${brandColor}`, 
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>Amount Received</div>
        <div style={{ fontSize: '32px', fontWeight: 'bold', color: brandColor }}>
          ₹{formatIndianCurrency(parseFloat(payment.amount))}
        </div>
        <div style={{ fontSize: '11px', color: '#666', marginTop: '10px', fontStyle: 'italic' }}>
          Indian Rupee {numberToWords(Math.round(parseFloat(payment.amount)))} Only
        </div>
      </div>

      {/* Invoice Reference */}
      {invoice && (
        <div className="notes-section" style={{ background: '#f8fafc', padding: '10px', borderRadius: '4px' }}>
          <div className="notes-label">Against Invoice</div>
          <div style={{ fontSize: '10px', lineHeight: '1.6' }}>
            <div>Invoice No: {invoice.number}</div>
            <div>Invoice Amount: ₹{formatIndianCurrency(parseFloat(invoice.total))}</div>
            <div>Balance Due: ₹{formatIndianCurrency(parseFloat(invoice.balanceDue))}</div>
          </div>
        </div>
      )}

      {/* Bank/Account */}
      {bank && (
        <div className="notes-section">
          <div className="notes-label">Deposited To</div>
          <div className="notes-text">{bank.name}</div>
        </div>
      )}

      {/* Reference */}
      {payment.reference && (
        <div className="notes-section">
          <div className="notes-label">Reference</div>
          <div className="notes-text">{payment.reference}</div>
        </div>
      )}

      {/* Notes */}
      {payment.notes && (
        <div className="notes-section">
          <div className="notes-label">Notes</div>
          <div className="notes-text">{payment.notes}</div>
        </div>
      )}

      {/* Signature */}
      <div className="signature-section">
        <div className="signature-box">
          <div className="signature-line">Authorized Signature</div>
        </div>
      </div>

      {/* Footer */}
      <div className="footer">
        Thank you for your payment!
      </div>
    </div>
  );
}

function ChecklistPrint({ checklist, plan, event, companySettings }: any) {
  // Use olive green for all documents
  const checklistStyles = baseStyles + `
    .checklist-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 10px; }
    .checklist-table th { background: #f5f5f5; padding: 8px 6px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
    .checklist-table th.text-right { text-align: right; }
    .checklist-table th.text-center { text-align: center; }
    .checklist-table td { padding: 6px; border-bottom: 1px solid #eee; vertical-align: top; }
    .checklist-table td.text-right { text-align: right; }
    .checklist-table td.text-center { text-align: center; }
    .checklist-table .section-row td { background: #6b9937; color: white; font-weight: bold; padding: 8px 6px; }
    .checklist-table .sl-no { width: 35px; text-align: center; }
    .checklist-table .qty-col { width: 50px; text-align: center; }
    .checklist-table .vendor-col { width: 100px; }
    .checklist-table .status-col { width: 80px; text-align: center; }
    .status-completed { color: #6b9937; font-weight: bold; }
    .status-pending { color: #666; }
    .progress-bar { height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; margin-top: 8px; }
    .progress-fill { height: 100%; background: #6b9937; }
    .summary-box { display: flex; gap: 20px; margin-bottom: 20px; }
    .summary-item { padding: 10px 15px; background: #f0fdf4; border-radius: 6px; }
    .summary-label { font-size: 9px; color: #666; }
    .summary-value { font-size: 16px; font-weight: bold; color: #6b9937; }
  `;

  const sortedItems = (checklist || []).sort((a: any, b: any) => (a.sortOrder || 0) - (b.sortOrder || 0));
  const totalItems = sortedItems.filter((i: any) => !i.isSection).length;
  const completedItems = sortedItems.filter((i: any) => !i.isSection && i.isChecked).length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="document">
      <style>{checklistStyles}</style>

      {/* Header */}
      <div className="header">
        <div className="company-info">
          <div className="company-logo">
            <img src={logo} alt="Logo" />
          </div>
          <div className="company-name" style={{ color: '#6b9937' }}>{companySettings?.companyName || 'Oakstreet Events'}</div>
          <div className="company-address">
            {(companySettings?.address || '2nd Floor, Above Devas Studio\nDeshabhimani press road\nKochi Kerala 682017\nIndia').split('\n').map((line: string, i: number) => (
              <div key={i}>{line}</div>
            ))}
          </div>
        </div>
        <div className="doc-type-box">
          <div className="doc-type" style={{ color: '#6b9937' }}>Production Checklist</div>
        </div>
      </div>

      {/* Document Info */}
      <div className="doc-info">
        <div className="doc-info-row">
          <span className="doc-info-label">Event</span>
          <span>: {plan?.title || event?.customerName || 'Event'}</span>
        </div>
        {event?.eventDate && (
          <div className="doc-info-row">
            <span className="doc-info-label">Event Date</span>
            <span>: {format(new Date(event.eventDate), 'dd/MM/yyyy')}</span>
          </div>
        )}
        {event?.venue && (
          <div className="doc-info-row">
            <span className="doc-info-label">Venue</span>
            <span>: {event.venue}</span>
          </div>
        )}
        <div className="doc-info-row">
          <span className="doc-info-label">Generated</span>
          <span>: {format(new Date(), 'dd/MM/yyyy')}</span>
        </div>
      </div>

      {/* Summary */}
      <div className="summary-box">
        <div className="summary-item">
          <div className="summary-label">Total Items</div>
          <div className="summary-value">{totalItems}</div>
        </div>
        <div className="summary-item">
          <div className="summary-label">Completed</div>
          <div className="summary-value" style={{ color: '#6b9937' }}>{completedItems}</div>
        </div>
        <div className="summary-item">
          <div className="summary-label">Pending</div>
          <div className="summary-value" style={{ color: '#666' }}>{totalItems - completedItems}</div>
        </div>
        <div className="summary-item" style={{ flex: 1 }}>
          <div className="summary-label">Progress</div>
          <div className="summary-value">{progressPercent}%</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progressPercent}%` }}></div>
          </div>
        </div>
      </div>

      {/* Checklist Table */}
      <table className="checklist-table">
        <thead>
          <tr>
            <th className="sl-no">Sl No</th>
            <th>Item & Description</th>
            <th className="qty-col">Qty</th>
            <th className="vendor-col">Vendor</th>
            <th className="status-col">Status</th>
          </tr>
        </thead>
        <tbody>
          {sortedItems.map((item: any, index: number) => {
            if (item.isSection) {
              return (
                <tr key={index} className="section-row">
                  <td colSpan={5}>{item.itemDescription}</td>
                </tr>
              );
            }
            return (
              <tr key={index}>
                <td className="sl-no">{item.slNo || ''}</td>
                <td>{item.itemDescription}</td>
                <td className="qty-col">{item.quantity || ''}</td>
                <td className="vendor-col">{item.vendorName || '-'}</td>
                <td className={`status-col ${item.isChecked ? 'status-completed' : 'status-pending'}`}>
                  {item.isChecked ? '✓ Done' : '○ Pending'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Signature */}
      <div className="signature-section">
        <div className="signature-box">
          <div className="signature-line">Prepared By</div>
        </div>
      </div>

      {/* Footer */}
      <div className="footer">Oakstreet Events</div>
    </div>
  );
}

function DeliveryChallanPrint({ challan, companySettings, hideHeader }: { challan: any; companySettings: any; hideHeader: boolean }) {
  const items = challan.items && Array.isArray(challan.items) ? challan.items : [];
  const subTotal = parseFloat(challan.subTotal) || 0;
  const cgstRate = parseFloat(challan.cgstRate) || 9;
  const sgstRate = parseFloat(challan.sgstRate) || 9;
  const cgstAmount = parseFloat(challan.cgstAmount) || 0;
  const sgstAmount = parseFloat(challan.sgstAmount) || 0;
  const totalAmount = parseFloat(challan.totalAmount) || 0;
  const rounding = parseFloat(challan.rounding) || 0;

  const challanStyles = `
    @media print {
      body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      @page { size: A4; margin: 10mm; }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 11px; color: #333; line-height: 1.4; }
    
    .dc-container { max-width: 800px; margin: 0 auto; padding: 15px; background: white; }
    
    .dc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid ${YEPMAN_BRAND_COLOR}; }
    .dc-company-info { flex: 1; }
    .dc-company-logo { width: 150px; height: 50px; margin-bottom: 5px; }
    .dc-company-logo img { width: 100%; height: 100%; object-fit: contain; }
    .dc-company-name { font-size: 18px; font-weight: bold; color: ${YEPMAN_BRAND_COLOR}; }
    .dc-company-details { font-size: 9px; color: #666; margin-top: 3px; }
    
    .dc-title-section { text-align: right; }
    .dc-title { font-size: 22px; font-weight: bold; color: ${YEPMAN_BRAND_COLOR}; margin-bottom: 8px; }
    .dc-info-grid { display: grid; gap: 3px; text-align: left; }
    .dc-info-row { display: flex; gap: 8px; font-size: 10px; }
    .dc-info-label { color: #666; min-width: 80px; }
    .dc-info-value { font-weight: 500; }
    
    .dc-parties { display: flex; gap: 30px; margin-bottom: 15px; }
    .dc-party-box { flex: 1; background: #f8f9fa; padding: 12px; border-radius: 4px; border-left: 3px solid ${YEPMAN_BRAND_COLOR}; }
    .dc-party-title { font-size: 10px; font-weight: bold; color: ${YEPMAN_BRAND_COLOR}; margin-bottom: 5px; text-transform: uppercase; }
    .dc-party-name { font-size: 13px; font-weight: bold; margin-bottom: 3px; }
    .dc-party-address { font-size: 10px; color: #555; white-space: pre-line; }
    
    .dc-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
    .dc-table th { background: ${YEPMAN_BRAND_COLOR}; color: white; padding: 8px 6px; text-align: left; font-size: 10px; font-weight: 600; }
    .dc-table th.right { text-align: right; }
    .dc-table th.center { text-align: center; }
    .dc-table td { padding: 8px 6px; border-bottom: 1px solid #eee; font-size: 10px; vertical-align: top; }
    .dc-table td.right { text-align: right; }
    .dc-table td.center { text-align: center; }
    .dc-table tr:nth-child(even) { background: #fafafa; }
    .dc-table .sl-col { width: 30px; }
    .dc-table .hsn-col { width: 80px; }
    .dc-table .qty-col { width: 50px; }
    .dc-table .unit-col { width: 40px; }
    .dc-table .rate-col { width: 80px; }
    .dc-table .amount-col { width: 90px; }
    
    .dc-summary-section { display: flex; justify-content: flex-end; margin-bottom: 15px; }
    .dc-summary { width: 280px; }
    .dc-summary-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 10px; border-bottom: 1px solid #eee; }
    .dc-summary-row.total { font-size: 13px; font-weight: bold; border-top: 2px solid ${YEPMAN_BRAND_COLOR}; border-bottom: none; padding-top: 8px; color: ${YEPMAN_BRAND_COLOR}; }
    .dc-amount-words { font-size: 9px; color: #666; margin-top: 8px; padding: 8px; background: #f8f9fa; border-radius: 4px; }
    
    .dc-footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; }
    .dc-notes { font-size: 9px; color: #666; margin-bottom: 15px; }
    .dc-notes-title { font-weight: bold; margin-bottom: 3px; }
    
    .dc-signature-section { display: flex; justify-content: space-between; margin-top: 30px; }
    .dc-signature-box { text-align: center; width: 180px; }
    .dc-signature-line { border-top: 1px solid #999; margin-top: 40px; padding-top: 5px; font-size: 10px; color: #666; }
    
    .dc-footer-text { text-align: center; margin-top: 20px; font-size: 9px; color: #888; }
  `;

  return (
    <div className="dc-container">
      <style>{challanStyles}</style>
      
      {/* Header */}
      {!hideHeader && (
        <div className="dc-header">
          <div className="dc-company-info">
            <div className="dc-company-logo">
              <img src={yepmanLogo} alt="Yepman International" />
            </div>
            <div className="dc-company-details">
              {companySettings?.address || 'Edathal P.O, Aluva, Ernakulam, Kerala - 683564'}<br />
              Ph: {companySettings?.phone || '+91 9895810975'} | GSTIN: {companySettings?.gstNumber || '32AALCS5678K1Z5'}
            </div>
          </div>
          <div className="dc-title-section">
            <div className="dc-title">DELIVERY CHALLAN</div>
            <div className="dc-info-grid">
              <div className="dc-info-row">
                <span className="dc-info-label">Challan No:</span>
                <span className="dc-info-value">{challan.challanNumber}</span>
              </div>
              <div className="dc-info-row">
                <span className="dc-info-label">Date:</span>
                <span className="dc-info-value">{format(new Date(challan.challanDate), 'dd/MM/yyyy')}</span>
              </div>
              <div className="dc-info-row">
                <span className="dc-info-label">Type:</span>
                <span className="dc-info-value">{challan.challanType}</span>
              </div>
              {challan.vehicleNumber && (
                <div className="dc-info-row">
                  <span className="dc-info-label">Vehicle No:</span>
                  <span className="dc-info-value">{challan.vehicleNumber}</span>
                </div>
              )}
              <div className="dc-info-row">
                <span className="dc-info-label">Place of Supply:</span>
                <span className="dc-info-value">{challan.placeOfSupply || 'Kerala (32)'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Parties */}
      <div className="dc-parties">
        <div className="dc-party-box">
          <div className="dc-party-title">Shipped From</div>
          <div className="dc-party-name">Yepman International</div>
          <div className="dc-party-address">
            {companySettings?.address || 'Edathal P.O, Aluva\nErnakulam, Kerala - 683564'}
          </div>
        </div>
        <div className="dc-party-box">
          <div className="dc-party-title">Deliver To</div>
          <div className="dc-party-name">{challan.deliverTo}</div>
          <div className="dc-party-address">{challan.deliveryAddress}</div>
        </div>
      </div>
      
      {/* Items Table */}
      <table className="dc-table">
        <thead>
          <tr>
            <th className="sl-col center">Sl.</th>
            <th>Description of Goods</th>
            <th className="hsn-col">HSN/SAC</th>
            <th className="qty-col center">Qty</th>
            <th className="unit-col center">Unit</th>
            <th className="rate-col right">Rate</th>
            <th className="amount-col right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item: any, index: number) => (
            <tr key={index}>
              <td className="center">{index + 1}</td>
              <td>{item.description}</td>
              <td>{item.hsnCode || '-'}</td>
              <td className="center">{item.quantity}</td>
              <td className="center">{item.unit || 'nos'}</td>
              <td className="right">{formatIndianCurrency(item.rate || 0)}</td>
              <td className="right">{formatIndianCurrency(item.amount || 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Summary */}
      <div className="dc-summary-section">
        <div className="dc-summary">
          <div className="dc-summary-row">
            <span>Sub Total:</span>
            <span>₹{formatIndianCurrency(subTotal)}</span>
          </div>
          <div className="dc-summary-row">
            <span>CGST @ {cgstRate}%:</span>
            <span>₹{formatIndianCurrency(cgstAmount)}</span>
          </div>
          <div className="dc-summary-row">
            <span>SGST @ {sgstRate}%:</span>
            <span>₹{formatIndianCurrency(sgstAmount)}</span>
          </div>
          {rounding !== 0 && (
            <div className="dc-summary-row">
              <span>Rounding:</span>
              <span>₹{rounding.toFixed(2)}</span>
            </div>
          )}
          <div className="dc-summary-row total">
            <span>Total:</span>
            <span>₹{formatIndianCurrency(totalAmount)}</span>
          </div>
          <div className="dc-amount-words">
            <strong>Amount in Words:</strong> {challan.totalInWords || `Indian Rupee ${numberToWords(Math.round(totalAmount))} Only`}
          </div>
        </div>
      </div>
      
      {/* Notes */}
      {challan.notes && (
        <div className="dc-notes">
          <div className="dc-notes-title">Notes:</div>
          {challan.notes}
        </div>
      )}
      
      {/* Signature */}
      <div className="dc-signature-section">
        <div className="dc-signature-box">
          <div className="dc-signature-line">Received By</div>
        </div>
        <div className="dc-signature-box">
          <div className="dc-signature-line">For Yepman International</div>
        </div>
      </div>
      
      <div className="dc-footer-text">
        This is a computer generated document and does not require a signature.
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { format } from "date-fns";
import logo from "@assets/oakstreet_white_1764858814551.png";

interface LineItem {
  slNo?: number;
  name: string;
  description?: string;
  quantity: number;
  rate: number;
  total: number;
  taxRate?: number;
  isHeading?: boolean;
}

interface DocumentData {
  estimate?: any;
  invoice?: any;
  payment?: any;
  customer?: any;
  bank?: any;
  companySettings?: any;
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
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export default function PrintDocument() {
  const params = useParams<{ type: string; id: string }>();
  const [data, setData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    return <QuotePrint estimate={estimate} customer={customer} companySettings={companySettings} />;
  }

  if (params.type === 'invoice' && invoice) {
    return <InvoicePrint invoice={invoice} customer={customer} companySettings={companySettings} />;
  }

  if (params.type === 'receipt' && payment) {
    return <ReceiptPrint payment={payment} customer={customer} invoice={invoice} bank={bank} companySettings={companySettings} />;
  }

  return <div className="p-8 text-center">Document not found</div>;
}

function QuotePrint({ estimate, customer, companySettings }: any) {
  const lineItems: LineItem[] = estimate.lineItems || [];

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        * { color: #000 !important; }
        .text-muted { color: #666 !important; }
        .bg-primary { background-color: #8B7355 !important; }
        .text-primary { color: #8B7355 !important; }
        .border-primary { border-color: #8B7355 !important; }
      `}</style>

      <div className="flex justify-between items-start mb-8">
        <div className="flex items-start gap-4">
          <img src={logo} alt="Oakstreet Events" className="h-16 w-auto bg-primary p-2 rounded" style={{ backgroundColor: '#8B7355' }} />
          <div>
            <h1 className="text-xl font-bold">{companySettings?.companyName || 'Oakstreet Events'}</h1>
            <p className="text-sm text-muted whitespace-pre-line" style={{ color: '#666' }}>
              {companySettings?.address || '2nd Floor, Above Devas Studio\nDeshabhimani press road\nKochi Kerala 682017\nIndia'}
            </p>
            <p className="text-sm">{companySettings?.phone || '7902373354'}</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold" style={{ color: '#8B7355' }}>QUOTE</h2>
          <p className="text-lg font-medium">{estimate.number}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-sm text-muted" style={{ color: '#666' }}>Bill To</p>
          <p className="font-medium">{customer?.name || '—'}</p>
          <p className="text-sm whitespace-pre-line">{estimate.customerAddress || customer?.address || ''}</p>
          {estimate.weddingPlannerName && (
            <p className="text-sm mt-2">
              <span className="text-muted" style={{ color: '#666' }}>Wedding Planner:</span> {estimate.weddingPlannerName}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="mb-2">
            <p className="text-sm text-muted" style={{ color: '#666' }}>Quote Date</p>
            <p className="font-medium">{format(new Date(estimate.date), 'dd/MM/yyyy')}</p>
          </div>
          {estimate.subject && (
            <div>
              <p className="text-sm text-muted" style={{ color: '#666' }}>Subject</p>
              <p className="font-medium">{estimate.subject}</p>
            </div>
          )}
        </div>
      </div>

      <table className="w-full mb-6 border-collapse">
        <thead>
          <tr style={{ backgroundColor: '#8B7355', color: 'white' }}>
            <th className="p-2 text-left w-12">#</th>
            <th className="p-2 text-left">Item & Description</th>
            <th className="p-2 text-right w-20">Qty</th>
            <th className="p-2 text-right w-28">Rate</th>
            <th className="p-2 text-right w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, index) => (
            item.isHeading ? (
              <tr key={index} style={{ backgroundColor: '#f5f5f5' }}>
                <td colSpan={5} className="p-2 font-bold text-sm" style={{ backgroundColor: '#eee' }}>
                  {item.name}
                </td>
              </tr>
            ) : (
              <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                <td className="p-2">{item.slNo}</td>
                <td className="p-2">
                  <p className="font-medium">{item.name}</p>
                  {item.description && <p className="text-sm text-muted" style={{ color: '#666' }}>{item.description}</p>}
                </td>
                <td className="p-2 text-right">{item.quantity}</td>
                <td className="p-2 text-right">{formatIndianCurrency(item.rate)}</td>
                <td className="p-2 text-right">{formatIndianCurrency(item.total)}</td>
              </tr>
            )
          ))}
        </tbody>
      </table>

      <div className="flex justify-end mb-6">
        <div className="w-72">
          <div className="flex justify-between py-1">
            <span>Sub Total</span>
            <span>{formatIndianCurrency(parseFloat(estimate.subtotal))}</span>
          </div>
          {parseFloat(estimate.discountPercent) > 0 && (
            <div className="flex justify-between py-1 text-red-600">
              <span>Discount ({estimate.discountPercent}%)</span>
              <span>-{formatIndianCurrency(parseFloat(estimate.discountAmount))}</span>
            </div>
          )}
          {parseFloat(estimate.serviceChargePercent) > 0 && (
            <div className="flex justify-between py-1">
              <span>Service Charge ({estimate.serviceChargePercent}%)</span>
              <span>{formatIndianCurrency(parseFloat(estimate.serviceChargeAmount))}</span>
            </div>
          )}
          <div className="flex justify-between py-2 font-bold text-lg border-t mt-2" style={{ borderColor: '#8B7355' }}>
            <span>Total</span>
            <span>{formatIndianCurrency(parseFloat(estimate.total))}</span>
          </div>
        </div>
      </div>

      <div className="mb-4 p-3 rounded" style={{ backgroundColor: '#f5f5f5' }}>
        <p className="text-sm font-medium">Total In Words</p>
        <p className="text-sm">{estimate.totalInWords || `Indian Rupee ${numberToWords(Math.round(parseFloat(estimate.total)))} Only`}</p>
      </div>

      {estimate.notes && (
        <div className="mb-4">
          <p className="text-sm font-medium">Notes</p>
          <p className="text-sm text-muted" style={{ color: '#666' }}>{estimate.notes}</p>
        </div>
      )}

      {estimate.terms && (
        <div className="mb-4">
          <p className="text-sm font-medium">Terms & Conditions</p>
          <p className="text-sm text-muted whitespace-pre-line" style={{ color: '#666' }}>{estimate.terms}</p>
        </div>
      )}

      <div className="mt-8 pt-4" style={{ borderTop: '1px solid #ddd' }}>
        <p className="text-sm text-muted" style={{ color: '#666' }}>{estimate.thankYouMessage || companySettings?.defaultThankYouMessage || 'Looking forward for your business.'}</p>
      </div>
    </div>
  );
}

function InvoicePrint({ invoice, customer, companySettings }: any) {
  const lineItems: LineItem[] = invoice.lineItems || [];

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        * { color: #000 !important; }
        .text-muted { color: #666 !important; }
        .bg-primary { background-color: #8B7355 !important; }
        .text-primary { color: #8B7355 !important; }
        .border-primary { border-color: #8B7355 !important; }
      `}</style>

      <div className="flex justify-between items-start mb-8">
        <div className="flex items-start gap-4">
          <img src={logo} alt="Oakstreet Events" className="h-16 w-auto bg-primary p-2 rounded" style={{ backgroundColor: '#8B7355' }} />
          <div>
            <h1 className="text-xl font-bold">{companySettings?.companyName || 'Oakstreet Events'}</h1>
            <p className="text-sm text-muted whitespace-pre-line" style={{ color: '#666' }}>
              {companySettings?.address || '2nd Floor, Above Devas Studio\nDeshabhimani press road\nKochi Kerala 682017\nIndia'}
            </p>
            <p className="text-sm">{companySettings?.phone || '7902373354'}</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold" style={{ color: '#2563eb' }}>INVOICE</h2>
          <p className="text-lg font-medium">{invoice.number}</p>
          <p className="text-sm mt-2">
            <span className="px-2 py-1 rounded text-sm" style={{ 
              backgroundColor: invoice.status === 'paid' ? '#22c55e' : invoice.status === 'overdue' ? '#ef4444' : '#eab308',
              color: 'white'
            }}>
              {invoice.status.toUpperCase()}
            </span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-sm text-muted" style={{ color: '#666' }}>Bill To</p>
          <p className="font-medium">{customer?.name || '—'}</p>
          <p className="text-sm whitespace-pre-line">{invoice.customerAddress || customer?.address || ''}</p>
          {invoice.weddingPlannerName && (
            <p className="text-sm mt-2">
              <span className="text-muted" style={{ color: '#666' }}>Wedding Planner:</span> {invoice.weddingPlannerName}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="mb-2">
            <p className="text-sm text-muted" style={{ color: '#666' }}>Invoice Date</p>
            <p className="font-medium">{format(new Date(invoice.date), 'dd/MM/yyyy')}</p>
          </div>
          {invoice.dueDate && (
            <div className="mb-2">
              <p className="text-sm text-muted" style={{ color: '#666' }}>Due Date</p>
              <p className="font-medium">{format(new Date(invoice.dueDate), 'dd/MM/yyyy')}</p>
            </div>
          )}
          {invoice.subject && (
            <div>
              <p className="text-sm text-muted" style={{ color: '#666' }}>Subject</p>
              <p className="font-medium">{invoice.subject}</p>
            </div>
          )}
        </div>
      </div>

      <table className="w-full mb-6 border-collapse">
        <thead>
          <tr style={{ backgroundColor: '#2563eb', color: 'white' }}>
            <th className="p-2 text-left w-12">#</th>
            <th className="p-2 text-left">Item & Description</th>
            <th className="p-2 text-right w-20">Qty</th>
            <th className="p-2 text-right w-28">Rate</th>
            <th className="p-2 text-right w-28">Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, index) => (
            item.isHeading ? (
              <tr key={index} style={{ backgroundColor: '#f5f5f5' }}>
                <td colSpan={5} className="p-2 font-bold text-sm" style={{ backgroundColor: '#eee' }}>
                  {item.name}
                </td>
              </tr>
            ) : (
              <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                <td className="p-2">{item.slNo}</td>
                <td className="p-2">
                  <p className="font-medium">{item.name}</p>
                  {item.description && <p className="text-sm text-muted" style={{ color: '#666' }}>{item.description}</p>}
                </td>
                <td className="p-2 text-right">{item.quantity}</td>
                <td className="p-2 text-right">{formatIndianCurrency(item.rate)}</td>
                <td className="p-2 text-right">{formatIndianCurrency(item.total)}</td>
              </tr>
            )
          ))}
        </tbody>
      </table>

      <div className="flex justify-end mb-6">
        <div className="w-72">
          <div className="flex justify-between py-1">
            <span>Sub Total</span>
            <span>{formatIndianCurrency(parseFloat(invoice.subtotal))}</span>
          </div>
          {parseFloat(invoice.discountPercent) > 0 && (
            <div className="flex justify-between py-1 text-red-600">
              <span>Discount ({invoice.discountPercent}%)</span>
              <span>-{formatIndianCurrency(parseFloat(invoice.discountAmount))}</span>
            </div>
          )}
          {parseFloat(invoice.serviceChargePercent) > 0 && (
            <div className="flex justify-between py-1">
              <span>Service Charge ({invoice.serviceChargePercent}%)</span>
              <span>{formatIndianCurrency(parseFloat(invoice.serviceChargeAmount))}</span>
            </div>
          )}
          <div className="flex justify-between py-2 font-bold text-lg border-t mt-2" style={{ borderColor: '#2563eb' }}>
            <span>Total</span>
            <span>{formatIndianCurrency(parseFloat(invoice.total))}</span>
          </div>
          {parseFloat(invoice.amountPaid) > 0 && (
            <div className="flex justify-between py-1 text-green-600">
              <span>Amount Paid</span>
              <span>-{formatIndianCurrency(parseFloat(invoice.amountPaid))}</span>
            </div>
          )}
          <div className="flex justify-between py-2 font-bold text-lg" style={{ backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
            <span>Balance Due</span>
            <span>{formatIndianCurrency(parseFloat(invoice.balanceDue))}</span>
          </div>
        </div>
      </div>

      <div className="mb-4 p-3 rounded" style={{ backgroundColor: '#f5f5f5' }}>
        <p className="text-sm font-medium">Total In Words</p>
        <p className="text-sm">{invoice.totalInWords || `Indian Rupee ${numberToWords(Math.round(parseFloat(invoice.total)))} Only`}</p>
      </div>

      {invoice.notes && (
        <div className="mb-4">
          <p className="text-sm font-medium">Notes</p>
          <p className="text-sm text-muted" style={{ color: '#666' }}>{invoice.notes}</p>
        </div>
      )}

      {invoice.terms && (
        <div className="mb-4">
          <p className="text-sm font-medium">Terms & Conditions</p>
          <p className="text-sm text-muted whitespace-pre-line" style={{ color: '#666' }}>{invoice.terms}</p>
        </div>
      )}

      <div className="mt-8 pt-4" style={{ borderTop: '1px solid #ddd' }}>
        <p className="text-sm text-muted" style={{ color: '#666' }}>{invoice.thankYouMessage || companySettings?.defaultThankYouMessage || 'Looking forward for your business.'}</p>
      </div>
    </div>
  );
}

function ReceiptPrint({ payment, customer, invoice, bank, companySettings }: any) {
  return (
    <div className="bg-white p-8 max-w-2xl mx-auto" style={{ fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @media print {
          body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
        * { color: #000 !important; }
        .text-muted { color: #666 !important; }
      `}</style>

      <div className="flex justify-between items-start mb-8">
        <div className="flex items-start gap-4">
          <img src={logo} alt="Oakstreet Events" className="h-16 w-auto p-2 rounded" style={{ backgroundColor: '#8B7355' }} />
          <div>
            <h1 className="text-xl font-bold">{companySettings?.companyName || 'Oakstreet Events'}</h1>
            <p className="text-sm text-muted whitespace-pre-line" style={{ color: '#666' }}>
              {companySettings?.address || '2nd Floor, Above Devas Studio\nDeshabhimani press road\nKochi Kerala 682017\nIndia'}
            </p>
            <p className="text-sm">{companySettings?.phone || '7902373354'}</p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold" style={{ color: '#22c55e' }}>Payment Receipt</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-8">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted" style={{ color: '#666' }}>Receipt No</p>
            <p className="font-medium">{payment.number}</p>
          </div>
          <div>
            <p className="text-sm text-muted" style={{ color: '#666' }}>Date</p>
            <p className="font-medium">{format(new Date(payment.date), 'dd/MM/yyyy')}</p>
          </div>
          <div>
            <p className="text-sm text-muted" style={{ color: '#666' }}>Payment Mode</p>
            <p className="font-medium capitalize">{payment.paymentMode.replace('_', ' ')}</p>
          </div>
          {payment.reference && (
            <div>
              <p className="text-sm text-muted" style={{ color: '#666' }}>Reference</p>
              <p className="font-medium">{payment.reference}</p>
            </div>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted" style={{ color: '#666' }}>Received From</p>
            <p className="font-medium">{customer?.name || '—'}</p>
          </div>
          {invoice && (
            <div>
              <p className="text-sm text-muted" style={{ color: '#666' }}>Against Invoice</p>
              <p className="font-medium">{invoice.number}</p>
            </div>
          )}
          {bank && (
            <div>
              <p className="text-sm text-muted" style={{ color: '#666' }}>Deposited To</p>
              <p className="font-medium">{bank.name}</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-6 rounded-lg text-center mb-8" style={{ backgroundColor: '#f0fdf4', border: '2px solid #22c55e' }}>
        <p className="text-sm text-muted mb-2" style={{ color: '#666' }}>Amount Received</p>
        <p className="text-4xl font-bold" style={{ color: '#22c55e' }}>{formatIndianCurrency(parseFloat(payment.amount))}</p>
        <p className="text-sm mt-2" style={{ color: '#666' }}>Indian Rupee {numberToWords(Math.round(parseFloat(payment.amount)))} Only</p>
      </div>

      {payment.notes && (
        <div className="mb-4">
          <p className="text-sm font-medium">Notes</p>
          <p className="text-sm text-muted" style={{ color: '#666' }}>{payment.notes}</p>
        </div>
      )}

      <div className="mt-8 pt-4" style={{ borderTop: '1px solid #ddd' }}>
        <p className="text-sm text-muted text-center" style={{ color: '#666' }}>Thank you for your payment!</p>
      </div>
    </div>
  );
}

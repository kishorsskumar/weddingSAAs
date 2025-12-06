import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { format } from "date-fns";
import logo from "@assets/oakstreet_white_1764858814551.png";

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

const printStyles = `
  @media print {
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    @page { size: A4; margin: 10mm; }
  }
  * { box-sizing: border-box; }
  .doc-container { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; color: #333; }
  .header-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
  .header-table td { vertical-align: top; padding: 0; }
  .company-logo { width: 80px; height: auto; }
  .company-name { font-size: 22px; font-weight: bold; color: #333; margin-bottom: 4px; }
  .company-address { font-size: 11px; color: #555; line-height: 1.4; }
  .doc-type { font-size: 28px; font-weight: bold; text-align: right; }
  .doc-type-estimate { color: #8B7355; }
  .doc-type-invoice { color: #2563eb; }
  .doc-type-receipt { color: #22c55e; }
  .info-row { display: flex; border: 1px solid #ddd; margin-bottom: 0; }
  .info-cell { flex: 1; padding: 8px 12px; border-right: 1px solid #ddd; }
  .info-cell:last-child { border-right: none; }
  .info-label { font-size: 10px; color: #666; margin-bottom: 2px; }
  .info-value { font-weight: 500; }
  .bill-ship-row { display: flex; border: 1px solid #ddd; border-top: none; }
  .bill-to, .ship-to { flex: 1; padding: 10px 12px; }
  .bill-to { border-right: 1px solid #ddd; }
  .section-label { font-size: 10px; color: #666; font-weight: 600; margin-bottom: 4px; }
  .customer-name { font-weight: bold; margin-bottom: 4px; }
  .customer-address { font-size: 11px; line-height: 1.4; color: #444; }
  .gstin-row { margin-top: 6px; font-size: 11px; }
  .subject-row { border: 1px solid #ddd; border-top: none; padding: 10px 12px; }
  .items-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
  .items-table th { background-color: #8B7355; color: white; padding: 8px 6px; text-align: left; font-weight: 600; }
  .items-table th.text-right { text-align: right; }
  .items-table th.text-center { text-align: center; }
  .items-table td { padding: 8px 6px; border-bottom: 1px solid #eee; vertical-align: top; }
  .items-table td.text-right { text-align: right; }
  .items-table td.text-center { text-align: center; }
  .items-table .heading-row td { background-color: #f5f5f5; font-weight: bold; }
  .items-table .gst-header { text-align: center; border-bottom: 1px solid rgba(255,255,255,0.3); padding-bottom: 4px; margin-bottom: 4px; }
  .items-table .gst-subheader { display: flex; justify-content: space-around; font-size: 9px; }
  .totals-section { display: flex; justify-content: flex-end; margin: 10px 0; }
  .totals-table { width: 280px; font-size: 11px; }
  .totals-row { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid #eee; }
  .totals-row.total { font-weight: bold; font-size: 13px; border-top: 2px solid #8B7355; border-bottom: none; padding-top: 8px; }
  .amount-words { background-color: #f9f9f9; padding: 10px 12px; margin: 10px 0; border-radius: 4px; }
  .amount-words-label { font-size: 10px; color: #666; margin-bottom: 2px; }
  .bank-details { margin: 15px 0; padding: 12px; background-color: #f5f5f5; border-radius: 4px; }
  .bank-title { font-weight: bold; margin-bottom: 8px; }
  .bank-row { display: flex; margin-bottom: 4px; }
  .bank-label { width: 120px; color: #666; }
  .notes-section, .terms-section { margin: 10px 0; }
  .section-title { font-weight: bold; margin-bottom: 4px; }
  .section-content { color: #555; white-space: pre-line; }
  .footer { margin-top: 20px; padding-top: 15px; border-top: 1px solid #ddd; text-align: center; font-size: 11px; color: #666; }
  .signature-section { margin-top: 40px; display: flex; justify-content: flex-end; }
  .signature-box { text-align: center; width: 200px; }
  .signature-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 5px; }
`;

function QuotePrint({ estimate, customer, companySettings }: any) {
  const lineItems: LineItem[] = estimate.lineItems || [];
  const hasGst = lineItems.some(item => item.cgstPercent || item.sgstPercent || item.taxRate);

  return (
    <div className="doc-container bg-white p-6 max-w-4xl mx-auto">
      <style>{printStyles}</style>

      <table className="header-table">
        <tbody>
          <tr>
            <td style={{ width: '70%' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <img src={logo} alt="Logo" className="company-logo" style={{ backgroundColor: '#8B7355', padding: '8px', borderRadius: '4px' }} />
                <div>
                  <div className="company-name">{companySettings?.companyName || 'Oakstreet Events'}</div>
                  <div className="company-address">
                    {(companySettings?.address || '2nd Floor, Above Devas Studio\nOpposite Deshabhimani Press, Kaloor\nKochi Kerala 682017\nIndia').split('\n').map((line: string, i: number) => (
                      <div key={i}>{line}</div>
                    ))}
                    {companySettings?.gstNumber && <div style={{ marginTop: '4px' }}>GSTIN {companySettings.gstNumber}</div>}
                  </div>
                </div>
              </div>
            </td>
            <td style={{ width: '30%', textAlign: 'right', verticalAlign: 'top' }}>
              <div className="doc-type doc-type-estimate">ESTIMATE</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="info-row">
        <div className="info-cell">
          <div className="info-label">#</div>
          <div className="info-value">{estimate.number}</div>
        </div>
        <div className="info-cell">
          <div className="info-label">Estimate Date</div>
          <div className="info-value">{format(new Date(estimate.date), 'dd/MM/yyyy')}</div>
        </div>
        <div className="info-cell">
          <div className="info-label">Place Of Supply</div>
          <div className="info-value">{companySettings?.placeOfSupply || 'Kerala (32)'}</div>
        </div>
      </div>

      <div className="bill-ship-row">
        <div className="bill-to">
          <div className="section-label">Bill To</div>
          <div className="customer-name">{customer?.name || '—'}</div>
          <div className="customer-address">{estimate.customerAddress || customer?.address || ''}</div>
          {customer?.gstNumber && <div className="gstin-row">GSTIN {customer.gstNumber}</div>}
        </div>
        <div className="ship-to">
          <div className="section-label">Ship To</div>
          <div className="customer-address">{estimate.shippingAddress || estimate.customerAddress || customer?.address || ''}</div>
          {customer?.gstNumber && <div className="gstin-row">GSTIN {customer.gstNumber}</div>}
        </div>
      </div>

      {estimate.subject && (
        <div className="subject-row">
          <div className="section-label">Subject :</div>
          <div>{estimate.subject}</div>
        </div>
      )}

      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: '30px' }}>#</th>
            <th>Item & Description</th>
            <th style={{ width: '70px' }}>HSN/SAC</th>
            <th className="text-right" style={{ width: '50px' }}>Qty</th>
            <th className="text-right" style={{ width: '80px' }}>Rate</th>
            {hasGst && (
              <>
                <th className="text-center" style={{ width: '80px' }}>
                  <div className="gst-header">CGST</div>
                  <div className="gst-subheader"><span>%</span><span>Amt</span></div>
                </th>
                <th className="text-center" style={{ width: '80px' }}>
                  <div className="gst-header">SGST</div>
                  <div className="gst-subheader"><span>%</span><span>Amt</span></div>
                </th>
              </>
            )}
            <th className="text-right" style={{ width: '90px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, index) => {
            if (item.isHeading) {
              return (
                <tr key={index} className="heading-row">
                  <td colSpan={hasGst ? 8 : 6}>{item.name}</td>
                </tr>
              );
            }
            const cgstPct = item.cgstPercent || (item.taxRate ? item.taxRate / 2 : 0);
            const sgstPct = item.sgstPercent || (item.taxRate ? item.taxRate / 2 : 0);
            const cgstAmt = item.cgstAmount || (item.total * cgstPct / 100);
            const sgstAmt = item.sgstAmount || (item.total * sgstPct / 100);
            return (
              <tr key={index}>
                <td>{item.slNo}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{item.name}</div>
                  {item.description && <div style={{ color: '#666', fontSize: '10px' }}>{item.description}</div>}
                </td>
                <td>{item.hsnCode || ''}</td>
                <td className="text-right">{item.quantity.toFixed(2)}</td>
                <td className="text-right">{formatIndianCurrency(item.rate)}</td>
                {hasGst && (
                  <>
                    <td className="text-center">
                      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                        <span>{cgstPct}%</span>
                        <span>{formatIndianCurrency(cgstAmt)}</span>
                      </div>
                    </td>
                    <td className="text-center">
                      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                        <span>{sgstPct}%</span>
                        <span>{formatIndianCurrency(sgstAmt)}</span>
                      </div>
                    </td>
                  </>
                )}
                <td className="text-right">{formatIndianCurrency(item.total + (hasGst ? cgstAmt + sgstAmt : 0))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="totals-section">
        <div className="totals-table">
          <div className="totals-row">
            <span>Sub Total</span>
            <span>{formatIndianCurrency(parseFloat(estimate.subtotal || estimate.total))}</span>
          </div>
          {parseFloat(estimate.discountPercent) > 0 && (
            <div className="totals-row" style={{ color: '#dc2626' }}>
              <span>Discount ({estimate.discountPercent}%)</span>
              <span>-{formatIndianCurrency(parseFloat(estimate.discountAmount))}</span>
            </div>
          )}
          {parseFloat(estimate.serviceChargePercent) > 0 && (
            <div className="totals-row">
              <span>Service Charge ({estimate.serviceChargePercent}%)</span>
              <span>{formatIndianCurrency(parseFloat(estimate.serviceChargeAmount))}</span>
            </div>
          )}
          <div className="totals-row total">
            <span>Total</span>
            <span>₹{formatIndianCurrency(parseFloat(estimate.total))}</span>
          </div>
        </div>
      </div>

      <div className="amount-words">
        <div className="amount-words-label">Total In Words</div>
        <div>{estimate.totalInWords || `Indian Rupee ${numberToWords(Math.round(parseFloat(estimate.total)))} Only`}</div>
      </div>

      {estimate.notes && (
        <div className="notes-section">
          <div className="section-title">Notes</div>
          <div className="section-content">{estimate.notes}</div>
        </div>
      )}

      {estimate.terms && (
        <div className="terms-section">
          <div className="section-title">Terms & Conditions</div>
          <div className="section-content">{estimate.terms}</div>
        </div>
      )}

      <div className="signature-section">
        <div className="signature-box">
          <div>For {companySettings?.companyName || 'Oakstreet Events'}</div>
          <div className="signature-line">Authorized Signatory</div>
        </div>
      </div>

      <div className="footer">
        {estimate.thankYouMessage || companySettings?.defaultThankYouMessage || 'Looking forward for your business.'}
      </div>
    </div>
  );
}

function InvoicePrint({ invoice, customer, companySettings }: any) {
  const lineItems: LineItem[] = invoice.lineItems || [];
  const hasGst = lineItems.some(item => item.cgstPercent || item.sgstPercent || item.taxRate);

  return (
    <div className="doc-container bg-white p-6 max-w-4xl mx-auto">
      <style>{printStyles.replace(/#8B7355/g, '#2563eb')}</style>

      <table className="header-table">
        <tbody>
          <tr>
            <td style={{ width: '70%' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <img src={logo} alt="Logo" className="company-logo" style={{ backgroundColor: '#2563eb', padding: '8px', borderRadius: '4px' }} />
                <div>
                  <div className="company-name">{companySettings?.companyName || 'Oakstreet Events'}</div>
                  <div className="company-address">
                    {(companySettings?.address || '2nd Floor, Above Devas Studio\nOpposite Deshabhimani Press, Kaloor\nKochi Kerala 682017\nIndia').split('\n').map((line: string, i: number) => (
                      <div key={i}>{line}</div>
                    ))}
                    {companySettings?.gstNumber && <div style={{ marginTop: '4px' }}>GSTIN {companySettings.gstNumber}</div>}
                  </div>
                </div>
              </div>
            </td>
            <td style={{ width: '30%', textAlign: 'right', verticalAlign: 'top' }}>
              <div className="doc-type doc-type-invoice">TAX INVOICE</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="info-row">
        <div className="info-cell">
          <div className="info-label">#</div>
          <div className="info-value">{invoice.number}</div>
        </div>
        <div className="info-cell">
          <div className="info-label">Invoice Date</div>
          <div className="info-value">{format(new Date(invoice.date), 'dd/MM/yyyy')}</div>
        </div>
        {invoice.dueDate && (
          <div className="info-cell">
            <div className="info-label">Due Date</div>
            <div className="info-value">{format(new Date(invoice.dueDate), 'dd/MM/yyyy')}</div>
          </div>
        )}
        <div className="info-cell">
          <div className="info-label">Place Of Supply</div>
          <div className="info-value">{companySettings?.placeOfSupply || 'Kerala (32)'}</div>
        </div>
      </div>

      <div className="bill-ship-row">
        <div className="bill-to">
          <div className="section-label">Bill To</div>
          <div className="customer-name">{customer?.name || '—'}</div>
          <div className="customer-address">{invoice.customerAddress || customer?.address || ''}</div>
          {customer?.gstNumber && <div className="gstin-row">GSTIN {customer.gstNumber}</div>}
        </div>
        <div className="ship-to">
          <div className="section-label">Ship To</div>
          <div className="customer-address">{invoice.shippingAddress || invoice.customerAddress || customer?.address || ''}</div>
          {customer?.gstNumber && <div className="gstin-row">GSTIN {customer.gstNumber}</div>}
        </div>
      </div>

      {invoice.subject && (
        <div className="subject-row">
          <div className="section-label">Subject :</div>
          <div>{invoice.subject}</div>
        </div>
      )}

      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: '30px' }}>#</th>
            <th>Item & Description</th>
            <th style={{ width: '70px' }}>HSN/SAC</th>
            <th className="text-right" style={{ width: '50px' }}>Qty</th>
            <th className="text-right" style={{ width: '80px' }}>Rate</th>
            {hasGst && (
              <>
                <th className="text-center" style={{ width: '80px' }}>
                  <div className="gst-header">CGST</div>
                  <div className="gst-subheader"><span>%</span><span>Amt</span></div>
                </th>
                <th className="text-center" style={{ width: '80px' }}>
                  <div className="gst-header">SGST</div>
                  <div className="gst-subheader"><span>%</span><span>Amt</span></div>
                </th>
              </>
            )}
            <th className="text-right" style={{ width: '90px' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lineItems.map((item, index) => {
            if (item.isHeading) {
              return (
                <tr key={index} className="heading-row">
                  <td colSpan={hasGst ? 8 : 6}>{item.name}</td>
                </tr>
              );
            }
            const cgstPct = item.cgstPercent || (item.taxRate ? item.taxRate / 2 : 0);
            const sgstPct = item.sgstPercent || (item.taxRate ? item.taxRate / 2 : 0);
            const cgstAmt = item.cgstAmount || (item.total * cgstPct / 100);
            const sgstAmt = item.sgstAmount || (item.total * sgstPct / 100);
            return (
              <tr key={index}>
                <td>{item.slNo}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{item.name}</div>
                  {item.description && <div style={{ color: '#666', fontSize: '10px' }}>{item.description}</div>}
                </td>
                <td>{item.hsnCode || ''}</td>
                <td className="text-right">{item.quantity.toFixed(2)}</td>
                <td className="text-right">{formatIndianCurrency(item.rate)}</td>
                {hasGst && (
                  <>
                    <td className="text-center">
                      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                        <span>{cgstPct}%</span>
                        <span>{formatIndianCurrency(cgstAmt)}</span>
                      </div>
                    </td>
                    <td className="text-center">
                      <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                        <span>{sgstPct}%</span>
                        <span>{formatIndianCurrency(sgstAmt)}</span>
                      </div>
                    </td>
                  </>
                )}
                <td className="text-right">{formatIndianCurrency(item.total + (hasGst ? cgstAmt + sgstAmt : 0))}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="totals-section">
        <div className="totals-table">
          <div className="totals-row">
            <span>Sub Total</span>
            <span>{formatIndianCurrency(parseFloat(invoice.subtotal || invoice.total))}</span>
          </div>
          {parseFloat(invoice.discountPercent) > 0 && (
            <div className="totals-row" style={{ color: '#dc2626' }}>
              <span>Discount ({invoice.discountPercent}%)</span>
              <span>-{formatIndianCurrency(parseFloat(invoice.discountAmount))}</span>
            </div>
          )}
          {parseFloat(invoice.serviceChargePercent) > 0 && (
            <div className="totals-row">
              <span>Service Charge ({invoice.serviceChargePercent}%)</span>
              <span>{formatIndianCurrency(parseFloat(invoice.serviceChargeAmount))}</span>
            </div>
          )}
          <div className="totals-row total" style={{ borderColor: '#2563eb' }}>
            <span>Total</span>
            <span>₹{formatIndianCurrency(parseFloat(invoice.total))}</span>
          </div>
          {parseFloat(invoice.amountPaid) > 0 && (
            <div className="totals-row" style={{ color: '#22c55e' }}>
              <span>Amount Paid</span>
              <span>-{formatIndianCurrency(parseFloat(invoice.amountPaid))}</span>
            </div>
          )}
          <div className="totals-row" style={{ backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px', fontWeight: 'bold' }}>
            <span>Balance Due</span>
            <span>₹{formatIndianCurrency(parseFloat(invoice.balanceDue))}</span>
          </div>
        </div>
      </div>

      <div className="amount-words">
        <div className="amount-words-label">Total In Words</div>
        <div>{invoice.totalInWords || `Indian Rupee ${numberToWords(Math.round(parseFloat(invoice.total)))} Only`}</div>
      </div>

      {(companySettings?.bankName || companySettings?.bankAccountNumber) && (
        <div className="bank-details">
          <div className="bank-title">Bank Details</div>
          {companySettings?.bankName && (
            <div className="bank-row"><span className="bank-label">Bank Name:</span><span>{companySettings.bankName}</span></div>
          )}
          {companySettings?.bankAccountNumber && (
            <div className="bank-row"><span className="bank-label">Account Number:</span><span>{companySettings.bankAccountNumber}</span></div>
          )}
          {companySettings?.bankIfscCode && (
            <div className="bank-row"><span className="bank-label">IFSC Code:</span><span>{companySettings.bankIfscCode}</span></div>
          )}
          {companySettings?.bankBranch && (
            <div className="bank-row"><span className="bank-label">Branch:</span><span>{companySettings.bankBranch}</span></div>
          )}
        </div>
      )}

      {invoice.notes && (
        <div className="notes-section">
          <div className="section-title">Notes</div>
          <div className="section-content">{invoice.notes}</div>
        </div>
      )}

      {invoice.terms && (
        <div className="terms-section">
          <div className="section-title">Terms & Conditions</div>
          <div className="section-content">{invoice.terms}</div>
        </div>
      )}

      <div className="signature-section">
        <div className="signature-box">
          <div>For {companySettings?.companyName || 'Oakstreet Events'}</div>
          <div className="signature-line">Authorized Signatory</div>
        </div>
      </div>

      <div className="footer">
        {invoice.thankYouMessage || companySettings?.defaultThankYouMessage || 'Looking forward for your business.'}
      </div>
    </div>
  );
}

function ReceiptPrint({ payment, customer, invoice, bank, companySettings }: any) {
  return (
    <div className="doc-container bg-white p-6 max-w-3xl mx-auto">
      <style>{printStyles.replace(/#8B7355/g, '#22c55e')}</style>

      <table className="header-table">
        <tbody>
          <tr>
            <td style={{ width: '60%' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <img src={logo} alt="Logo" className="company-logo" style={{ backgroundColor: '#22c55e', padding: '8px', borderRadius: '4px' }} />
                <div>
                  <div className="company-name">{companySettings?.companyName || 'Oakstreet Events'}</div>
                  <div className="company-address">
                    {(companySettings?.address || '2nd Floor, Above Devas Studio\nOpposite Deshabhimani Press, Kaloor\nKochi Kerala 682017\nIndia').split('\n').map((line: string, i: number) => (
                      <div key={i}>{line}</div>
                    ))}
                    {companySettings?.gstNumber && <div style={{ marginTop: '4px' }}>GSTIN {companySettings.gstNumber}</div>}
                  </div>
                </div>
              </div>
            </td>
            <td style={{ width: '40%', textAlign: 'right', verticalAlign: 'top' }}>
              <div className="doc-type doc-type-receipt">PAYMENT<br/>RECEIPT</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="info-row" style={{ marginTop: '15px' }}>
        <div className="info-cell">
          <div className="info-label">Receipt No</div>
          <div className="info-value">{payment.number}</div>
        </div>
        <div className="info-cell">
          <div className="info-label">Date</div>
          <div className="info-value">{format(new Date(payment.date), 'dd/MM/yyyy')}</div>
        </div>
        <div className="info-cell">
          <div className="info-label">Payment Mode</div>
          <div className="info-value" style={{ textTransform: 'capitalize' }}>{payment.paymentMode.replace('_', ' ')}</div>
        </div>
      </div>

      <div className="bill-ship-row" style={{ marginTop: '0', borderTop: 'none' }}>
        <div className="bill-to">
          <div className="section-label">Received From</div>
          <div className="customer-name">{customer?.name || '—'}</div>
          <div className="customer-address">{customer?.address || ''}</div>
          {customer?.gstNumber && <div className="gstin-row">GSTIN {customer.gstNumber}</div>}
        </div>
        <div className="ship-to">
          {invoice && (
            <>
              <div className="section-label">Against Invoice</div>
              <div className="info-value">{invoice.number}</div>
              <div style={{ marginTop: '8px' }}>
                <span className="info-label">Invoice Amount: </span>
                <span>₹{formatIndianCurrency(parseFloat(invoice.total))}</span>
              </div>
            </>
          )}
          {payment.reference && (
            <div style={{ marginTop: '8px' }}>
              <div className="section-label">Reference</div>
              <div className="info-value">{payment.reference}</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ 
        margin: '20px 0', 
        padding: '30px', 
        backgroundColor: '#f0fdf4', 
        border: '2px solid #22c55e', 
        borderRadius: '8px', 
        textAlign: 'center' 
      }}>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>Amount Received</div>
        <div style={{ fontSize: '36px', fontWeight: 'bold', color: '#22c55e' }}>
          ₹{formatIndianCurrency(parseFloat(payment.amount))}
        </div>
        <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
          Indian Rupee {numberToWords(Math.round(parseFloat(payment.amount)))} Only
        </div>
      </div>

      {bank && (
        <div className="bank-details" style={{ backgroundColor: '#f5f5f5' }}>
          <div className="bank-title">Deposited To</div>
          <div className="bank-row"><span className="bank-label">Bank/Account:</span><span>{bank.name}</span></div>
          {bank.accountNumber && (
            <div className="bank-row"><span className="bank-label">Account Number:</span><span>****{bank.accountNumber.slice(-4)}</span></div>
          )}
        </div>
      )}

      {payment.notes && (
        <div className="notes-section">
          <div className="section-title">Notes</div>
          <div className="section-content">{payment.notes}</div>
        </div>
      )}

      <div className="signature-section">
        <div className="signature-box">
          <div>For {companySettings?.companyName || 'Oakstreet Events'}</div>
          <div className="signature-line">Authorized Signatory</div>
        </div>
      </div>

      <div className="footer">
        Thank you for your payment!
      </div>
    </div>
  );
}

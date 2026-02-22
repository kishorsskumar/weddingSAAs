import { useEffect, useState } from "react";

export default function ClientPortalGuidePDF() {
  const [isReady, setIsReady] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const generatePDF = () => {
    setDownloading(true);
    const element = document.getElementById('pdf-content');
    if (element && (window as any).html2pdf) {
      const opt = {
        margin: [10, 10, 10, 10],
        filename: 'Oakstreet-Client-Portal-Development-Guide.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
      };
      (window as any).html2pdf().set(opt).from(element).save().then(() => {
        setDownloading(false);
      });
    }
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = () => {
      setIsReady(true);
      setTimeout(() => {
        generatePDF();
      }, 1000);
    };
    document.head.appendChild(script);
  }, []);

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-4xl mx-auto text-center py-8">
        <h1 className="text-2xl font-bold text-green-800 mb-4">Client Portal Development Guide</h1>
        {downloading ? (
          <p className="text-lg text-gray-600">Generating PDF, please wait...</p>
        ) : (
          <>
            <p className="text-gray-600 mb-4">Click the button below to download the PDF guide.</p>
            <button
              onClick={generatePDF}
              disabled={!isReady}
              className="bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg disabled:opacity-50"
              data-testid="button-download-pdf"
            >
              {isReady ? 'Download PDF' : 'Loading...'}
            </button>
          </>
        )}
      </div>
      
      <div id="pdf-content" className="max-w-4xl mx-auto bg-white" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px', lineHeight: '1.4' }}>
        <div style={{ textAlign: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '2px solid #2d5a3d' }}>
          <h1 style={{ color: '#2d5a3d', fontSize: '22px', margin: '0 0 5px 0' }}>Oakstreet Client Portal</h1>
          <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>Development Guide</p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#2d5a3d', fontSize: '14px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>Overview</h2>
          <p>The Client Portal allows customers to view their estimates and invoices, track event progress, chat with Oaksy AI, manage RSVPs, upload documents, and view payment status.</p>
          <p><strong>Subdomain:</strong> clients.oakstreetevent.com</p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#2d5a3d', fontSize: '14px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>Step 1: Create New Replit Project</h2>
          <ol style={{ paddingLeft: '20px', margin: '10px 0' }}>
            <li>Go to replit.com</li>
            <li>Click "Create Repl"</li>
            <li>Select Node.js template</li>
            <li>Name it: oakstreet-client-portal</li>
          </ol>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#2d5a3d', fontSize: '14px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>Step 2: Project Structure</h2>
          <pre style={{ background: '#f5f5f5', padding: '10px', fontSize: '10px', overflow: 'auto' }}>{`oakstreet-client-portal/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/           (copy from main project)
│   │   │   └── portal/       (new portal components)
│   │   ├── pages/
│   │   │   ├── portal-login.tsx
│   │   │   ├── portal-dashboard.tsx
│   │   │   ├── portal-documents.tsx
│   │   │   ├── portal-events.tsx
│   │   │   ├── portal-rsvp.tsx
│   │   │   └── portal-chat.tsx
│   │   ├── context/
│   │   │   └── portal-auth-context.tsx
│   │   ├── lib/
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── index.html
├── server/
│   ├── index.ts
│   ├── routes.ts
│   ├── storage.ts
│   ├── whatsapp-service.ts    (copy from main project)
│   └── oaksy-client-ai.ts     (simplified version)
├── shared/
│   └── schema.ts              (copy from main project)
└── package.json`}</pre>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#2d5a3d', fontSize: '14px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>Step 3: Files to Copy from Main Project</h2>
          <h3 style={{ fontSize: '12px', color: '#444', marginTop: '10px' }}>Required Files (Copy As-Is)</h3>
          <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
            <li><strong>UI Components:</strong> client/src/components/ui/*</li>
            <li><strong>Database Schema:</strong> shared/schema.ts</li>
            <li><strong>WhatsApp Service:</strong> server/whatsapp-service.ts</li>
            <li><strong>Styling:</strong> client/src/index.css, tailwind.config.ts, postcss.config.js</li>
            <li><strong>Config Files:</strong> tsconfig.json, vite.config.ts, drizzle.config.ts</li>
          </ul>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#2d5a3d', fontSize: '14px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>Step 4: Environment Variables</h2>
          <p>Add these secrets in the new Replit project:</p>
          <pre style={{ background: '#f5f5f5', padding: '10px', fontSize: '10px' }}>{`DATABASE_URL=<same as main project>
OPENAI_API_KEY=<your OpenAI key>
TWILIO_ACCOUNT_SID=<your Twilio SID>
TWILIO_AUTH_TOKEN=<your Twilio token>
TWILIO_WHATSAPP_NUMBER=<your WhatsApp number>`}</pre>
          <p style={{ color: '#c00', fontWeight: 'bold' }}>Important: Use the SAME DATABASE_URL so both apps access the same data.</p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#2d5a3d', fontSize: '14px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>Step 5: Key Features to Implement</h2>
          
          <h3 style={{ fontSize: '12px', color: '#444', marginTop: '10px' }}>1. Token-Based Authentication</h3>
          <p>Clients access via secure portal links (no login required):</p>
          <pre style={{ background: '#f5f5f5', padding: '8px', fontSize: '9px' }}>{`https://clients.oakstreetevent.com/portal/abc123xyz...`}</pre>
          
          <h3 style={{ fontSize: '12px', color: '#444', marginTop: '10px' }}>2. Client Dashboard</h3>
          <p>Show: Active events, pending invoices, RSVP statistics, recent activity</p>
          
          <h3 style={{ fontSize: '12px', color: '#444', marginTop: '10px' }}>3. Oaksy WhatsApp Integration</h3>
          <p>Simplified AI that helps clients with event details, payments, RSVP, and general questions.</p>
          
          <h3 style={{ fontSize: '12px', color: '#444', marginTop: '10px' }}>4. Document Viewing</h3>
          <p>Display estimates and invoices with download option</p>
          
          <h3 style={{ fontSize: '12px', color: '#444', marginTop: '10px' }}>5. RSVP Management</h3>
          <p>Let clients view and manage RSVPs for their events</p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#2d5a3d', fontSize: '14px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>Step 6: Deployment</h2>
          <ol style={{ paddingLeft: '20px', margin: '10px 0' }}>
            <li>Click Publish in your new Replit project</li>
            <li>Choose Autoscale or Reserved VM</li>
            <li>After deployment, go to Deployments → Settings</li>
            <li>Click Link a domain</li>
            <li>Enter: clients.oakstreetevent.com</li>
            <li>Add the DNS records to your domain registrar</li>
          </ol>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#2d5a3d', fontSize: '14px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>Step 7: Connecting Both Apps</h2>
          <p>In the main Oakstreet app, generate portal links when creating quotes/invoices:</p>
          <pre style={{ background: '#f5f5f5', padding: '8px', fontSize: '9px' }}>{`const portalUrl = \`https://clients.oakstreetevent.com/portal/\${token}\`;
// Send this URL to customer via WhatsApp or email`}</pre>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#2d5a3d', fontSize: '14px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>Design Consistency</h2>
          <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
            <li><strong>Primary Color:</strong> Oak Green - hsl(135, 35%, 30%)</li>
            <li><strong>Background:</strong> White with subtle gray borders</li>
            <li><strong>Font:</strong> Inter</li>
            <li><strong>Style:</strong> Clean, professional (Zoho-inspired)</li>
          </ul>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ color: '#2d5a3d', fontSize: '14px', borderBottom: '1px solid #ddd', paddingBottom: '5px' }}>Security Considerations</h2>
          <ul style={{ paddingLeft: '20px', margin: '5px 0' }}>
            <li><strong>Token-based access:</strong> No passwords needed, unique links per customer</li>
            <li><strong>Expiring links:</strong> Set expiry dates for sensitive documents</li>
            <li><strong>Read-only by default:</strong> Clients can view but not modify data</li>
            <li><strong>Rate limiting:</strong> 20 requests/minute to prevent abuse</li>
            <li><strong>Customer isolation:</strong> Each client only sees their own data</li>
          </ul>
        </div>

        <div style={{ textAlign: 'center', marginTop: '30px', paddingTop: '15px', borderTop: '1px solid #ddd', color: '#666', fontSize: '10px' }}>
          <p>Oakstreet Events - Client Portal Development Guide</p>
          <p>For assistance, contact the development team</p>
        </div>
      </div>
    </div>
  );
}

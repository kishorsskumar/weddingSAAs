import { useEffect, useRef } from "react";
import logo from "../assets/atbott-logo-dark.png";
import html2pdf from "html2pdf.js";

export default function RsvpFlowPdf() {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = "RSVP - Customer Flow";
    // Auto-trigger PDF download
    const timer = setTimeout(() => {
      if (contentRef.current) {
        const opt = {
          margin: 10,
          filename: 'Oak-RSVP-Customer-Flow.pdf',
          image: { type: 'jpeg' as const, quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
        };
        html2pdf().set(opt).from(contentRef.current).save();
      }
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const pdfStyles = `
    @page { 
      size: A4; 
      margin: 8mm; 
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
    }
    .pdf-container {
      font-family: 'Inter', system-ui, sans-serif;
      max-width: 100%;
      margin: 0 auto;
      padding: 12px;
      background: white;
      font-size: 11px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
      border-bottom: 2px solid #3d6b3d;
      padding-bottom: 10px;
    }
    .logo { width: 100px; height: auto; }
    .header-title {
      text-align: right;
    }
    .header-title h1 {
      font-size: 18px;
      color: #3d6b3d;
      margin: 0;
      font-weight: 700;
    }
    .header-title p {
      font-size: 10px;
      color: #666;
      margin: 3px 0 0 0;
    }
    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: #3d6b3d;
      margin: 12px 0 8px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-title .step-number {
      width: 22px;
      height: 22px;
      background: #3d6b3d;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
    }
    .flow-step {
      background: #f9fafb;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 10px;
      border: 1px solid #e5e7eb;
      page-break-inside: avoid;
    }
    .chat-container {
      background: #e5ddd5;
      border-radius: 6px;
      padding: 10px;
      max-width: 280px;
    }
    .chat-header {
      background: #3d6b3d;
      color: white;
      padding: 6px 10px;
      border-radius: 6px 6px 0 0;
      margin: -10px -10px 10px -10px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .chat-header-icon {
      width: 24px;
      height: 24px;
      background: rgba(255,255,255,0.2);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .chat-header-text h3 { margin: 0; font-size: 12px; font-weight: 600; }
    .chat-header-text p { margin: 0; font-size: 9px; opacity: 0.8; }
    .message-bot {
      background: white;
      border-radius: 6px;
      border-top-left-radius: 0;
      padding: 8px;
      margin-bottom: 6px;
      font-size: 11px;
      line-height: 1.4;
      box-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }
    .message-user {
      background: #dcf8c6;
      border-radius: 6px;
      border-top-right-radius: 0;
      padding: 6px 10px;
      margin-bottom: 6px;
      font-size: 11px;
      margin-left: auto;
      max-width: 70%;
      text-align: right;
    }
    .response-buttons {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 6px;
    }
    .btn-primary {
      background: #3d6b3d;
      color: white;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .btn-outline {
      background: white;
      border: 1px solid #ddd;
      padding: 5px 12px;
      border-radius: 6px;
      font-size: 11px;
    }
    .dashboard-preview {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      overflow: hidden;
    }
    .dashboard-header {
      background: #f3f4f6;
      padding: 6px 10px;
      border-bottom: 1px solid #e5e7eb;
      font-size: 11px;
      font-weight: 600;
      color: #374151;
    }
    .dashboard-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 10px;
      border-bottom: 1px solid #f3f4f6;
      font-size: 11px;
    }
    .dashboard-row.highlight { background: #f0fdf4; }
    .badge {
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 9px;
      font-weight: 500;
    }
    .badge-green { background: #dcfce7; color: #166534; }
    .badge-yellow { background: #fef9c3; color: #854d0e; }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 10px;
    }
    .stat-box {
      text-align: center;
      padding: 8px;
      border-radius: 6px;
    }
    .stat-box.green { background: #f0fdf4; }
    .stat-box.yellow { background: #fefce8; }
    .stat-box.blue { background: #eff6ff; }
    .stat-box .number { font-size: 18px; font-weight: 700; }
    .stat-box .label { font-size: 9px; color: #666; }
    .benefits-list {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      margin-top: 12px;
    }
    .benefit-item {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 10px;
      background: #f0fdf4;
      border-radius: 6px;
    }
    .benefit-icon {
      width: 26px;
      height: 26px;
      background: #3d6b3d;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 12px;
    }
    .benefit-text h4 { margin: 0 0 2px 0; font-size: 11px; font-weight: 600; color: #1f2937; }
    .benefit-text p { margin: 0; font-size: 10px; color: #6b7280; line-height: 1.3; }
    .footer {
      margin-top: 20px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
      text-align: center;
      font-size: 10px;
      color: #6b7280;
    }
    .footer-address {
      margin-bottom: 6px;
      line-height: 1.4;
    }
    .contact-info {
      display: flex;
      justify-content: center;
      gap: 15px;
      margin-top: 6px;
    }
    .print-btn {
      position: fixed;
      top: 20px;
      right: 20px;
      background: #3d6b3d;
      color: white;
      border: none;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .print-btn:hover { background: #2d5a2d; }
  `;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="pdf-container" ref={contentRef}>
      <style>{pdfStyles}</style>
      
      <button className="print-btn no-print" onClick={handlePrint}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        Download PDF
      </button>

      {/* Header */}
      <div className="header">
        <img src={logo} alt="Company Logo" className="logo" />
        <div className="header-title">
          <h1>RSVP Service</h1>
          <p>Smart Guest Management for Your Events</p>
        </div>
      </div>

      {/* Step 1: Guest Receives Invite */}
      <div className="section-title">
        <span className="step-number">1</span>
        Guest Receives WhatsApp Invite
      </div>
      <div className="flow-step">
        <div className="chat-container">
          <div className="chat-header">
            <div className="chat-header-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
            <div className="chat-header-text">
              <h3>Oaksy</h3>
              <p>AI Assistant</p>
            </div>
          </div>
          <div className="message-bot">
            Hi Rahul! 👋<br /><br />
            You're invited to <strong>Anjali's Wedding</strong> on <strong>Feb 10, 2026</strong> at Grand Hyatt, Mumbai.<br /><br />
            Will you be attending?
          </div>
          <div className="response-buttons">
            <div className="btn-primary">✓ Attending</div>
            <div className="btn-outline" style={{ color: '#dc2626', borderColor: '#fecaca' }}>✕ Not Attending</div>
            <div className="btn-outline" style={{ color: '#ca8a04', borderColor: '#fef08a' }}>? Maybe</div>
          </div>
        </div>
      </div>

      {/* Step 2: Guest Responds */}
      <div className="section-title">
        <span className="step-number">2</span>
        Guest Provides Details
      </div>
      <div className="flow-step">
        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
          <div className="chat-container" style={{ flex: 1, minWidth: '280px' }}>
            <div className="chat-header">
              <div className="chat-header-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
                </svg>
              </div>
              <div className="chat-header-text">
                <h3>Oaksy</h3>
                <p>AI Assistant</p>
              </div>
            </div>
            <div className="message-user">✅ Attending</div>
            <div className="message-bot">Wonderful! 🎉 How many guests will be joining?</div>
            <div className="message-user">3 guests</div>
            <div className="message-bot">Great! What's your meal preference?</div>
            <div className="message-user">🥗 Vegetarian</div>
            <div className="message-bot">
              ✅ <strong>RSVP Confirmed!</strong><br /><br />
              Party of 3 • Vegetarian<br /><br />
              See you at Anjali's Wedding! 💍
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: Dashboard Update */}
      <div className="section-title">
        <span className="step-number">3</span>
        Real-Time Dashboard Update
      </div>
      <div className="flow-step">
        <div className="dashboard-preview">
          <div className="dashboard-header">Anjali's Wedding - Guest Responses</div>
          <div className="dashboard-row highlight">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '24px', height: '24px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
              <strong>Rahul Sharma</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span>3 guests</span>
              <span style={{ color: '#16a34a' }}>Veg</span>
              <span className="badge badge-green">Confirmed</span>
            </div>
          </div>
          <div className="dashboard-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#9ca3af' }}>
              <div style={{ width: '24px', height: '24px', background: '#f3f4f6', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⏳</div>
              Priya Nair
            </div>
            <span className="badge badge-yellow">Pending</span>
          </div>
        </div>
        <div className="stats-grid">
          <div className="stat-box green">
            <div className="number" style={{ color: '#16a34a' }}>15</div>
            <div className="label">Confirmed</div>
          </div>
          <div className="stat-box yellow">
            <div className="number" style={{ color: '#ca8a04' }}>8</div>
            <div className="label">Pending</div>
          </div>
          <div className="stat-box blue">
            <div className="number" style={{ color: '#2563eb' }}>42</div>
            <div className="label">Total Guests</div>
          </div>
        </div>
      </div>

      {/* Step 4: Automated Reminders */}
      <div className="section-title">
        <span className="step-number">4</span>
        Automated Follow-up Reminders
      </div>
      <div className="flow-step">
        <div className="chat-container">
          <div className="chat-header">
            <div className="chat-header-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
              </svg>
            </div>
            <div className="chat-header-text">
              <h3>Oaksy</h3>
              <p>Auto Reminder</p>
            </div>
          </div>
          <div className="message-bot">
            Hi Priya! 👋<br /><br />
            Friendly reminder about <strong>Anjali's Wedding</strong> on Feb 10!<br /><br />
            We noticed you haven't responded yet. Will you be attending?
          </div>
          <div className="response-buttons">
            <div className="btn-primary">✓ Yes, I'll attend</div>
            <div className="btn-outline" style={{ color: '#dc2626', borderColor: '#fecaca' }}>✕ Can't make it</div>
          </div>
        </div>
        <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '15px', fontStyle: 'italic' }}>
          Oaksy automatically sends reminders to pending guests 7 days and 24 hours before the event.
        </p>
      </div>

      {/* Benefits */}
      <div className="section-title">
        <span className="step-number">★</span>
        Why Choose Our RSVP Service?
      </div>
      <div className="benefits-list">
        <div className="benefit-item">
          <div className="benefit-icon">📱</div>
          <div className="benefit-text">
            <h4>No App Downloads</h4>
            <p>Guests respond directly on WhatsApp - works for everyone</p>
          </div>
        </div>
        <div className="benefit-item">
          <div className="benefit-icon">🤖</div>
          <div className="benefit-text">
            <h4>AI-Powered</h4>
            <p>Oaksy handles all follow-ups automatically</p>
          </div>
        </div>
        <div className="benefit-item">
          <div className="benefit-icon">📊</div>
          <div className="benefit-text">
            <h4>Real-Time Tracking</h4>
            <p>Live dashboard with instant response updates</p>
          </div>
        </div>
        <div className="benefit-item">
          <div className="benefit-icon">🍽️</div>
          <div className="benefit-text">
            <h4>Meal Planning</h4>
            <p>Automatic veg/non-veg counts for caterers</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="footer">
        <div className="footer-address">
          <strong>RSVP Service</strong>
        </div>
        <div className="contact-info">
          <span>📞 Contact Us</span>
        </div>
      </div>
    </div>
  );
}

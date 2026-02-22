import { useEffect, useRef, useState } from "react";
import logo from "@assets/OAK_1_1766646679471.jpg";
import html2pdf from "html2pdf.js";

const OAK_GREEN = '#4b7c29';
const OAK_DARK = '#3d6b3d';

export default function RsvpServicePdf() {
  const contentRef = useRef<HTMLDivElement>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    document.title = "Oak RSVP Service - Brochure | Oakstreet Events";
  }, []);

  const handleDownload = () => {
    if (!contentRef.current || downloading) return;
    setDownloading(true);
    const opt = {
      margin: 0,
      filename: 'Oakstreet-RSVP-Service-Brochure.pdf',
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    html2pdf().set(opt).from(contentRef.current).save().then(() => setDownloading(false));
  };

  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      <button
        onClick={handleDownload}
        className="no-print"
        style={{
          position: 'fixed', top: 20, right: 20, background: OAK_GREEN, color: 'white',
          border: 'none', padding: '14px 28px', borderRadius: '10px', fontSize: '15px',
          fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)', zIndex: 1000
        }}
      >
        {downloading ? '⏳ Generating...' : '📥 Download PDF'}
      </button>

      <div ref={contentRef} style={{ maxWidth: '210mm', margin: '0 auto', background: 'white', fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
        <style>{`
          @page { size: A4; margin: 0; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none !important; } }
          .page { width: 210mm; min-height: 297mm; position: relative; overflow: hidden; box-sizing: border-box; }
          .page-break { page-break-after: always; }
        `}</style>

        {/* ========== PAGE 1: HERO / COVER ========== */}
        <div className="page page-break" style={{ background: `linear-gradient(135deg, #f8faf5 0%, #eef5e6 30%, #dcecc8 70%, ${OAK_GREEN}15 100%)`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '6px', background: `linear-gradient(90deg, ${OAK_GREEN}, #7ab840, ${OAK_GREEN})` }} />
          <div style={{ position: 'absolute', top: '30px', left: '30px' }}>
            <img src={logo} alt="Oakstreet" style={{ height: '50px', borderRadius: '8px' }} />
          </div>
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <div style={{ width: '90px', height: '90px', borderRadius: '50%', background: `linear-gradient(135deg, ${OAK_GREEN}, #7ab840)`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 30px', boxShadow: '0 8px 32px rgba(75,124,41,0.3)' }}>
              <span style={{ fontSize: '40px' }}>💌</span>
            </div>
            <h1 style={{ fontSize: '42px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 8px 0', letterSpacing: '-1px', lineHeight: 1.15 }}>
              Oak RSVP
            </h1>
            <p style={{ fontSize: '18px', color: OAK_GREEN, fontWeight: 600, margin: '0 0 20px 0', letterSpacing: '2px', textTransform: 'uppercase' }}>
              Digital Guest Management
            </p>
            <div style={{ width: '60px', height: '3px', background: OAK_GREEN, margin: '0 auto 25px', borderRadius: '2px' }} />
            <p style={{ fontSize: '16px', color: '#555', lineHeight: 1.7, maxWidth: '420px', margin: '0 auto 40px' }}>
              A complete digital RSVP &amp; guest management system designed exclusively for weddings and celebrations. Beautiful landing pages, smart guest tracking, and seamless communication — all in one platform.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', maxWidth: '480px', margin: '0 auto' }}>
              {[
                { icon: '🌐', label: 'Custom Wedding Pages', sub: 'Branded & Beautiful' },
                { icon: '📊', label: 'Live RSVP Tracking', sub: 'Real-time Dashboard' },
                { icon: '💬', label: 'WhatsApp Integration', sub: 'Instant Invites' },
              ].map((item, i) => (
                <div key={i} style={{ background: 'rgba(255,255,255,0.85)', borderRadius: '12px', padding: '20px 12px', textAlign: 'center', border: '1px solid rgba(75,124,41,0.15)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>{item.icon}</div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a1a1a', marginBottom: '3px' }}>{item.label}</div>
                  <div style={{ fontSize: '10px', color: '#888' }}>{item.sub}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ position: 'absolute', bottom: '30px', textAlign: 'center', width: '100%' }}>
            <p style={{ fontSize: '11px', color: '#999', margin: 0 }}>www.oakstreetevent.com</p>
          </div>
        </div>

        {/* ========== PAGE 2: THE WEDDING LANDING PAGE ========== */}
        <div className="page page-break" style={{ padding: '30px 35px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: `2px solid ${OAK_GREEN}`, paddingBottom: '12px' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Beautiful Wedding Landing Pages</h2>
              <p style={{ fontSize: '12px', color: '#777', margin: '4px 0 0' }}>TheKnot-inspired design with full customization</p>
            </div>
            <img src={logo} alt="Oakstreet" style={{ height: '35px', borderRadius: '6px' }} />
          </div>

          <div style={{ background: '#fafbf8', borderRadius: '12px', border: '1px solid #e8ede3', padding: '20px', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: OAK_DARK, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: OAK_GREEN, color: 'white', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>1</span>
              Personalized Wedding Website
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <div style={{ background: 'linear-gradient(135deg, #fdf2f8, #fce7f3, #f5d0fe)', borderRadius: '10px', padding: '20px', border: '1px solid rgba(236,72,153,0.15)', minHeight: '180px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
                  <p style={{ fontSize: '10px', color: 'rgba(120,80,110,0.7)', margin: '0 0 6px', fontStyle: 'italic' }}>Together with their families</p>
                  <h4 style={{ fontSize: '22px', fontWeight: 700, color: '#3a2535', margin: '0 0 6px', fontFamily: 'Georgia, serif' }}>Varun &amp; Neha</h4>
                  <p style={{ fontSize: '10px', color: 'rgba(120,80,110,0.7)', margin: '0 0 12px' }}>cordially invite you to celebrate their wedding</p>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center', fontSize: '10px', color: 'rgba(100,70,95,0.65)' }}>
                    <span>📅 April 12, 2026</span>
                    <span style={{ color: '#ddd' }}>|</span>
                    <span>📍 Vijaya Convention</span>
                  </div>
                  <div style={{ marginTop: '14px', background: 'rgba(255,255,255,0.6)', borderRadius: '8px', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '100px', height: '28px', borderRadius: '6px', border: '1px solid #ddd', background: 'white', display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '9px', color: '#aaa' }}>Search name...</div>
                    <div style={{ background: OAK_GREEN, color: 'white', borderRadius: '6px', padding: '4px 10px', fontSize: '9px', fontWeight: 600 }}>🔍</div>
                  </div>
                </div>
                <p style={{ fontSize: '9px', color: '#999', textAlign: 'center', marginTop: '6px', fontStyle: 'italic' }}>Live Preview — Wedding Landing Page</p>
              </div>
              <div>
                <p style={{ fontSize: '11px', color: '#444', lineHeight: 1.7, margin: '0 0 12px' }}>
                  Every event gets its own beautifully designed landing page that guests can access via a unique link or QR code.
                </p>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {[
                    { icon: '🎨', title: 'Custom Branding', desc: 'Hero images, couple photos, colour themes' },
                    { icon: '🔗', title: 'Unique Event URL', desc: 'e.g. oakstreetevent.com/rsvp/e/VARUNNEHA' },
                    { icon: '📱', title: 'QR Code Access', desc: 'Print on physical invites for instant access' },
                    { icon: '🔍', title: 'Name Search', desc: 'Guests find their invitation instantly' },
                    { icon: '➕', title: 'Self-Registration', desc: 'New guests can register themselves' },
                    { icon: '🎉', title: 'Event Functions', desc: 'Wedding, Engagement, Haldi, Sangeet & more' },
                  ].map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '12px', flexShrink: 0 }}>{f.icon}</span>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: '#333' }}>{f.title}</div>
                        <div style={{ fontSize: '9px', color: '#888' }}>{f.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div style={{ background: '#fafbf8', borderRadius: '12px', border: '1px solid #e8ede3', padding: '20px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: OAK_DARK, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: OAK_GREEN, color: 'white', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>2</span>
              Smart RSVP Response Form
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div>
                <p style={{ fontSize: '11px', color: '#444', lineHeight: 1.7, margin: '0 0 12px' }}>
                  Once guests find their name, they're taken to an elegant RSVP form with glass-morphism design and floral accents.
                </p>
                <div style={{ display: 'grid', gap: '8px' }}>
                  {[
                    { icon: '✅', title: 'Attendance Confirmation', desc: 'Attending / Regret / Maybe options' },
                    { icon: '👥', title: 'Guest Count', desc: 'Adults and children separately' },
                    { icon: '🍽️', title: 'Meal Preference', desc: 'Vegetarian / Non-vegetarian' },
                    { icon: '🎊', title: 'Event Selection', desc: 'Choose which ceremonies to attend' },
                    { icon: '✈️', title: 'Travel Logistics', desc: 'Airport pickup, hotel, transport needs' },
                    { icon: '📝', title: 'Special Requests', desc: 'Dietary restrictions, messages, notes' },
                  ].map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '12px', flexShrink: 0 }}>{f.icon}</span>
                      <div>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: '#333' }}>{f.title}</div>
                        <div style={{ fontSize: '9px', color: '#888' }}>{f.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ background: 'linear-gradient(135deg, #fdf2f8, #fce7f3)', borderRadius: '10px', padding: '16px', border: '1px solid rgba(236,72,153,0.1)' }}>
                  <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: '8px', padding: '12px', marginBottom: '10px', backdropFilter: 'blur(8px)', textAlign: 'center' }}>
                    <p style={{ fontSize: '9px', color: 'rgba(100,60,90,0.7)', margin: '0 0 4px' }}>Together with their families</p>
                    <p style={{ fontSize: '16px', fontWeight: 700, color: '#3a2535', margin: '0 0 4px', fontFamily: 'Georgia, serif' }}>Varun &amp; Neha</p>
                    <p style={{ fontSize: '8px', color: 'rgba(100,60,90,0.6)', margin: 0 }}>cordially invite you to celebrate their wedding</p>
                  </div>
                  <div style={{ background: 'white', borderRadius: '8px', padding: '12px' }}>
                    <p style={{ fontSize: '11px', fontWeight: 600, margin: '0 0 6px', color: '#222' }}>Responding for: Raj Sharma</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', marginBottom: '10px' }}>
                      <div style={{ background: '#f0f5eb', border: `1.5px solid ${OAK_GREEN}`, borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                        <span style={{ fontSize: '14px' }}>✓</span>
                        <p style={{ fontSize: '9px', fontWeight: 600, margin: '2px 0 0' }}>Attending</p>
                      </div>
                      <div style={{ border: '1.5px solid #e0e0e0', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                        <span style={{ fontSize: '14px', color: '#ccc' }}>✕</span>
                        <p style={{ fontSize: '9px', color: '#999', margin: '2px 0 0' }}>Regret</p>
                      </div>
                      <div style={{ border: '1.5px solid #e0e0e0', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                        <span style={{ fontSize: '14px', color: '#ccc' }}>?</span>
                        <p style={{ fontSize: '9px', color: '#999', margin: '2px 0 0' }}>Maybe</p>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginBottom: '8px' }}>
                      <div style={{ border: '1px solid #eee', borderRadius: '6px', padding: '6px', textAlign: 'center' }}>
                        <p style={{ fontSize: '8px', color: '#999', margin: '0 0 2px' }}>Adults</p>
                        <p style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>3</p>
                      </div>
                      <div style={{ border: '1px solid #eee', borderRadius: '6px', padding: '6px', textAlign: 'center' }}>
                        <p style={{ fontSize: '8px', color: '#999', margin: '0 0 2px' }}>Children</p>
                        <p style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>1</p>
                      </div>
                    </div>
                    <div style={{ background: OAK_GREEN, color: 'white', borderRadius: '6px', padding: '8px', textAlign: 'center', fontSize: '11px', fontWeight: 600 }}>
                      Submit RSVP →
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: '9px', color: '#999', textAlign: 'center', marginTop: '6px', fontStyle: 'italic' }}>Live Preview — RSVP Response Form</p>
              </div>
            </div>
          </div>

          <div style={{ position: 'absolute', bottom: '15px', left: '35px', right: '35px', textAlign: 'center', fontSize: '9px', color: '#ccc' }}>
            Oakstreet Events — Oak RSVP Service Brochure — Page 2
          </div>
        </div>

        {/* ========== PAGE 3: ADMIN DASHBOARD + WHATSAPP ========== */}
        <div className="page page-break" style={{ padding: '30px 35px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: `2px solid ${OAK_GREEN}`, paddingBottom: '12px' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Powerful Management Dashboard</h2>
              <p style={{ fontSize: '12px', color: '#777', margin: '4px 0 0' }}>Complete visibility into guest responses & analytics</p>
            </div>
            <img src={logo} alt="Oakstreet" style={{ height: '35px', borderRadius: '6px' }} />
          </div>

          <div style={{ background: '#fafbf8', borderRadius: '12px', border: '1px solid #e8ede3', padding: '20px', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: OAK_DARK, margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ background: OAK_GREEN, color: 'white', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>3</span>
              Live Analytics Dashboard
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '16px' }}>
              {[
                { n: '248', l: 'Total Guests', c: '#f0fdf4', tc: '#166534' },
                { n: '187', l: 'Confirmed', c: '#dcfce7', tc: '#15803d' },
                { n: '34', l: 'Pending', c: '#fef9c3', tc: '#a16207' },
                { n: '27', l: 'Declined', c: '#fee2e2', tc: '#dc2626' },
              ].map((s, i) => (
                <div key={i} style={{ background: s.c, borderRadius: '8px', padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', fontWeight: 800, color: s.tc }}>{s.n}</div>
                  <div style={{ fontSize: '9px', color: '#666', fontWeight: 500 }}>{s.l}</div>
                </div>
              ))}
            </div>

            <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', background: '#f9fafb', padding: '8px 12px', borderBottom: '1px solid #e5e7eb', fontSize: '10px', fontWeight: 600, color: '#555' }}>
                <span>Guest Name</span><span>Status</span><span>PAX</span><span>Functions</span><span>Meal</span>
              </div>
              {[
                { name: 'Raj Sharma & Family', status: 'Confirmed', sc: '#dcfce7', stc: '#166534', pax: '4', fn: 'All', meal: 'Veg' },
                { name: 'Priya Menon', status: 'Confirmed', sc: '#dcfce7', stc: '#166534', pax: '2', fn: 'Wedding', meal: 'Non-veg' },
                { name: 'Arun Kumar', status: 'Pending', sc: '#fef9c3', stc: '#a16207', pax: '—', fn: '—', meal: '—' },
                { name: 'Meera & Suresh', status: 'Confirmed', sc: '#dcfce7', stc: '#166534', pax: '3', fn: 'All', meal: 'Veg' },
                { name: 'Deepak Nair', status: 'Declined', sc: '#fee2e2', stc: '#dc2626', pax: '—', fn: '—', meal: '—' },
              ].map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', padding: '7px 12px', borderBottom: '1px solid #f3f4f6', fontSize: '10px', alignItems: 'center' }}>
                  <span style={{ fontWeight: 500, color: '#333' }}>{r.name}</span>
                  <span><span style={{ background: r.sc, color: r.stc, padding: '2px 6px', borderRadius: '10px', fontSize: '8px', fontWeight: 600 }}>{r.status}</span></span>
                  <span style={{ color: '#666' }}>{r.pax}</span>
                  <span style={{ color: '#666' }}>{r.fn}</span>
                  <span style={{ color: '#666' }}>{r.meal}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '9px', color: '#999', textAlign: 'center', marginTop: '8px', fontStyle: 'italic' }}>Oak RSVP — Admin Guest List View</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ background: '#fafbf8', borderRadius: '12px', border: '1px solid #e8ede3', padding: '18px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: OAK_DARK, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: OAK_GREEN, color: 'white', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>4</span>
                WhatsApp Integration
              </h3>
              <div style={{ background: '#e5ddd5', borderRadius: '8px', padding: '10px' }}>
                <div style={{ background: '#075e54', color: 'white', padding: '6px 10px', borderRadius: '6px 6px 0 0', margin: '-10px -10px 8px', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '14px' }}>💬</span> Oakstreet Events
                </div>
                <div style={{ background: 'white', borderRadius: '6px', padding: '8px', marginBottom: '6px', fontSize: '10px', lineHeight: 1.5, borderTopLeftRadius: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.08)' }}>
                  Dear Raj Sharma,<br/>
                  You're invited to the wedding of <b>Varun &amp; Neha</b>!<br/><br/>
                  📅 April 12, 2026<br/>
                  📍 Vijaya Convention Centre<br/><br/>
                  Please RSVP: <span style={{ color: '#1d4ed8', textDecoration: 'underline' }}>rsvp.oak/VARUNNEHA</span>
                </div>
                <div style={{ background: '#dcf8c6', borderRadius: '6px', padding: '6px 10px', marginLeft: 'auto', maxWidth: '60%', textAlign: 'right', fontSize: '10px', borderTopRightRadius: 0 }}>
                  ✅ I will attend!
                </div>
              </div>
              <div style={{ marginTop: '10px', display: 'grid', gap: '6px' }}>
                {['Bulk invite via WhatsApp', 'Automated follow-up reminders', 'Real-time delivery tracking'].map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '10px', color: '#555' }}>
                    <span style={{ color: OAK_GREEN, fontWeight: 700 }}>✓</span> {t}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#fafbf8', borderRadius: '12px', border: '1px solid #e8ede3', padding: '18px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: OAK_DARK, margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ background: OAK_GREEN, color: 'white', width: '22px', height: '22px', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px' }}>5</span>
                Configurable Settings
              </h3>
              <p style={{ fontSize: '10px', color: '#666', lineHeight: 1.6, margin: '0 0 10px' }}>
                Every event's RSVP page is fully customizable from the admin panel:
              </p>
              <div style={{ display: 'grid', gap: '6px' }}>
                {[
                  'Custom event functions (Wedding, Haldi, Sangeet, etc.)',
                  'Per-function date, time & venue details',
                  'Toggle sections: meal, transport, accommodation',
                  'Custom header text & invitation message',
                  'Guest group/coordinator allocation',
                  'Bulk import guests via CSV',
                  'Form field visibility controls',
                  'Landing page hero image & QR code',
                  'Self-registration enable/disable',
                  'Email & WhatsApp RSVP confirmation',
                ].map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', fontSize: '10px', color: '#555' }}>
                    <span style={{ color: OAK_GREEN, fontWeight: 700, flexShrink: 0, marginTop: '1px' }}>✓</span> {t}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ position: 'absolute', bottom: '15px', left: '35px', right: '35px', textAlign: 'center', fontSize: '9px', color: '#ccc' }}>
            Oakstreet Events — Oak RSVP Service Brochure — Page 3
          </div>
        </div>

        {/* ========== PAGE 4: GUEST EXPERIENCE FLOW + LOGISTICS + CTA ========== */}
        <div className="page" style={{ padding: '30px 35px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', borderBottom: `2px solid ${OAK_GREEN}`, paddingBottom: '12px' }}>
            <div>
              <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>The Complete Guest Journey</h2>
              <p style={{ fontSize: '12px', color: '#777', margin: '4px 0 0' }}>From invitation to arrival — everything managed</p>
            </div>
            <img src={logo} alt="Oakstreet" style={{ height: '35px', borderRadius: '6px' }} />
          </div>

          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            {[
              { step: '1', title: 'Receive Invite', desc: 'Via WhatsApp, Email, or printed QR', icon: '📩' },
              { step: '2', title: 'Visit Landing Page', desc: 'Beautiful wedding website', icon: '🌐' },
              { step: '3', title: 'Search & Find', desc: 'Find your name instantly', icon: '🔍' },
              { step: '4', title: 'Confirm RSVP', desc: 'Attendance, pax, meal, logistics', icon: '✅' },
              { step: '5', title: 'Get Updates', desc: 'Reminders & event details', icon: '🔔' },
            ].map((s, i) => (
              <div key={i} style={{ flex: '1', minWidth: '80px', textAlign: 'center', position: 'relative' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `linear-gradient(135deg, ${OAK_GREEN}, #7ab840)`, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px', fontSize: '16px', fontWeight: 700 }}>
                  {s.icon}
                </div>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#333', marginBottom: '2px' }}>Step {s.step}</div>
                <div style={{ fontSize: '10px', fontWeight: 600, color: OAK_DARK }}>{s.title}</div>
                <div style={{ fontSize: '8px', color: '#888', marginTop: '2px' }}>{s.desc}</div>
                {i < 4 && (
                  <div style={{ position: 'absolute', top: '18px', right: '-10px', color: '#ccc', fontSize: '12px' }}>→</div>
                )}
              </div>
            ))}
          </div>

          <div style={{ background: '#fafbf8', borderRadius: '12px', border: '1px solid #e8ede3', padding: '20px', marginBottom: '18px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: OAK_DARK, margin: '0 0 14px' }}>
              🏨 Travel & Logistics Management
            </h3>
            <p style={{ fontSize: '11px', color: '#555', lineHeight: 1.6, margin: '0 0 14px' }}>
              Guests can provide their complete travel details during RSVP — giving planners full visibility for logistics arrangements.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
              {[
                { icon: '✈️', title: 'Airport/Station Pickup', items: ['Flight/Train number', 'Arrival date & time', 'Pickup point', 'Contact person'] },
                { icon: '🏨', title: 'Accommodation', items: ['Check-in / Check-out dates', 'Number of rooms needed', 'Hotel preferences', 'Hotel allocation by admin'] },
                { icon: '🚗', title: 'Local Transport', items: ['Pickup date & time', 'Drop date & time', 'Vehicle arrangements', 'Driver coordination'] },
              ].map((s, i) => (
                <div key={i} style={{ background: 'white', borderRadius: '8px', border: '1px solid #e8ede3', padding: '14px' }}>
                  <div style={{ fontSize: '20px', marginBottom: '6px' }}>{s.icon}</div>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#333', marginBottom: '8px' }}>{s.title}</div>
                  {s.items.map((it, j) => (
                    <div key={j} style={{ fontSize: '9px', color: '#666', padding: '2px 0', display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <span style={{ color: OAK_GREEN, fontSize: '8px' }}>●</span> {it}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
            <div style={{ background: '#fafbf8', borderRadius: '12px', border: '1px solid #e8ede3', padding: '18px' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 700, color: OAK_DARK, margin: '0 0 10px' }}>🧭 Additional Logistics</h3>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  { icon: '🗺️', title: 'Tour Plans', desc: 'Post-event sightseeing preferences' },
                  { icon: '🚪', title: 'Departure Details', desc: 'Flight/train, date, time for drop-off' },
                  { icon: '👔', title: 'Dress Code', desc: 'Event-specific attire guidelines' },
                  { icon: '👤', title: 'Alternate Contact', desc: 'Secondary contact for coordination' },
                ].map((f, i) => (
                  <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '12px', flexShrink: 0 }}>{f.icon}</span>
                    <div>
                      <div style={{ fontSize: '10px', fontWeight: 600, color: '#333' }}>{f.title}</div>
                      <div style={{ fontSize: '9px', color: '#888' }}>{f.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ background: `linear-gradient(135deg, ${OAK_GREEN}15, ${OAK_GREEN}08)`, borderRadius: '12px', border: `1px solid ${OAK_GREEN}30`, padding: '18px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: OAK_DARK, margin: '0 0 8px' }}>Why Oak RSVP?</h3>
              <div style={{ display: 'grid', gap: '8px' }}>
                {[
                  'Eliminates paper invites & manual tracking',
                  'Real-time guest count for venue & catering',
                  'Reduces follow-up calls by 80%+',
                  'Professional image for your clients',
                  'Complete logistics visibility pre-event',
                  'Works on any device — mobile-first design',
                ].map((t, i) => (
                  <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '10px', color: '#333' }}>
                    <span style={{ color: OAK_GREEN, fontWeight: 700, fontSize: '12px' }}>★</span> {t}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: `linear-gradient(135deg, ${OAK_GREEN}, #5a9030)`, borderRadius: '12px', padding: '24px', textAlign: 'center', color: 'white' }}>
            <h3 style={{ fontSize: '18px', fontWeight: 700, margin: '0 0 6px' }}>Ready to elevate your guest experience?</h3>
            <p style={{ fontSize: '12px', opacity: 0.9, margin: '0 0 12px' }}>Contact us to set up Oak RSVP for your next event</p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', fontSize: '11px' }}>
              <span>📞 +91 70126 96353</span>
              <span>🌐 www.oakstreetevent.com</span>
              <span>✉️ hello@oakstreetevent.com</span>
            </div>
          </div>

          <div style={{ marginTop: '15px', textAlign: 'center' }}>
            <img src={logo} alt="Oakstreet Events" style={{ height: '30px', borderRadius: '6px', opacity: 0.5 }} />
            <p style={{ fontSize: '9px', color: '#bbb', margin: '6px 0 0' }}>© 2026 Oakstreet Events. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

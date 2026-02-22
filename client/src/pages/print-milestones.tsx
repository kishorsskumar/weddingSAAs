import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { format, parseISO } from "date-fns";

interface Event {
  id: string;
  title: string;
  customer: string;
  date: string;
  venue: string;
  planner: string;
  type: string;
}

interface Milestone {
  id: string;
  eventId: string;
  phase: number;
  phaseName: string;
  name: string;
  date: string;
  time: string | null;
  status: string;
}

interface CompanySettings {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  logo: string | null;
}

export default function PrintMilestones() {
  const [, params] = useRoute("/print/milestones/:eventId");
  const eventId = params?.eventId;
  
  const [event, setEvent] = useState<Event | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;

    const fetchData = async () => {
      try {
        const [eventRes, milestonesRes, settingsRes] = await Promise.all([
          fetch(`/api/events/${eventId}`, { credentials: 'include' }),
          fetch(`/api/milestones?eventId=${eventId}`, { credentials: 'include' }),
          fetch('/api/company-settings', { credentials: 'include' })
        ]);

        if (eventRes.ok) {
          const eventData = await eventRes.json();
          setEvent(eventData);
        }

        if (milestonesRes.ok) {
          const milestonesData = await milestonesRes.json();
          setMilestones(milestonesData);
        }

        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          setCompanySettings(settingsData);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [eventId]);

  useEffect(() => {
    if (!loading && event) {
      setTimeout(() => {
        (window as any).printReady = true;
      }, 300);
    }
  }, [loading, event]);

  const formatDate = (dateStr: string) => {
    try {
      return format(parseISO(dateStr), 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  const groupedMilestones = milestones.reduce((acc, m) => {
    if (!acc[m.phase]) {
      acc[m.phase] = { phaseName: m.phaseName, milestones: [] };
    }
    acc[m.phase].milestones.push(m);
    return acc;
  }, {} as Record<number, { phaseName: string; milestones: Milestone[] }>);

  const phaseNames: Record<number, string> = {
    1: 'Event Kickoff',
    2: 'Design',
    3: 'Procurement & Production',
    4: 'Logistics & Coordination',
    5: 'Event Week',
    6: 'Event Day',
    7: 'Packup & Closure',
  };

  for (let i = 1; i <= 7; i++) {
    if (!groupedMilestones[i]) {
      groupedMilestones[i] = { phaseName: phaseNames[i], milestones: [] };
    }
    groupedMilestones[i].milestones.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Event not found</p>
      </div>
    );
  }

  const completedCount = milestones.filter(m => m.status === 'completed').length;
  const totalCount = milestones.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .page-break {
            page-break-before: always;
          }
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
          color: #1f2937;
          line-height: 1.5;
        }
        .phase-header {
          background: linear-gradient(135deg, #4b7c29 0%, #6b9937 100%);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          margin-bottom: 12px;
        }
        .task-row {
          display: flex;
          align-items: center;
          padding: 8px 12px;
          border-bottom: 1px solid #e5e7eb;
        }
        .task-row:last-child {
          border-bottom: none;
        }
        .status-badge {
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
        }
        .status-completed {
          background-color: #dcfce7;
          color: #166534;
        }
        .status-pending {
          background-color: #fef3c7;
          color: #92400e;
        }
        .checkbox {
          width: 16px;
          height: 16px;
          border: 2px solid #d1d5db;
          border-radius: 3px;
          margin-right: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .checkbox.checked {
          background-color: #22c55e;
          border-color: #22c55e;
        }
        .checkbox.checked::after {
          content: '✓';
          color: white;
          font-size: 11px;
          font-weight: bold;
        }
      `}</style>

      <div className="max-w-4xl mx-auto p-8 bg-white">
        <div className="mb-8 border-b pb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-1">Event Timeline</h1>
              <p className="text-gray-500 text-sm">{companySettings?.companyName || 'Company'}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Generated on</p>
              <p className="font-medium">{format(new Date(), 'dd MMM yyyy')}</p>
            </div>
          </div>
        </div>

        <div className="mb-8 bg-gray-50 rounded-lg p-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900 mb-3">{event.title}</h2>
              <div className="space-y-2 text-sm">
                <p><span className="text-gray-500">Customer:</span> <span className="font-medium">{event.customer}</span></p>
                <p><span className="text-gray-500">Event Date:</span> <span className="font-medium">{formatDate(event.date)}</span></p>
                <p><span className="text-gray-500">Venue:</span> <span className="font-medium">{event.venue}</span></p>
                <p><span className="text-gray-500">Event Type:</span> <span className="font-medium">{event.type}</span></p>
                <p><span className="text-gray-500">Wedding Planner:</span> <span className="font-medium">{event.planner}</span></p>
              </div>
            </div>
            <div className="flex flex-col items-end justify-center">
              <div className="text-center">
                <div className="text-4xl font-bold text-green-600">{progressPercent}%</div>
                <p className="text-sm text-gray-500 mt-1">Overall Progress</p>
                <p className="text-xs text-gray-400 mt-1">{completedCount} of {totalCount} tasks completed</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {[1, 2, 3, 4, 5, 6, 7].map((phaseNum) => {
            const phase = groupedMilestones[phaseNum];
            const phaseCompleted = phase.milestones.filter(m => m.status === 'completed').length;
            const phaseTotal = phase.milestones.length;
            const phaseProgress = phaseTotal > 0 ? Math.round((phaseCompleted / phaseTotal) * 100) : 0;

            return (
              <div key={phaseNum} className="border rounded-lg overflow-hidden">
                <div className="phase-header flex justify-between items-center">
                  <div>
                    <span className="font-bold">Phase {phaseNum}:</span>
                    <span className="ml-2">{phase.phaseName}</span>
                  </div>
                  <div className="text-sm opacity-90">
                    {phaseCompleted}/{phaseTotal} ({phaseProgress}%)
                  </div>
                </div>

                {phase.milestones.length === 0 ? (
                  <div className="p-4 text-center text-gray-400 text-sm italic">
                    No tasks in this phase
                  </div>
                ) : (
                  <div className="bg-white">
                    {phase.milestones.map((milestone, idx) => (
                      <div key={milestone.id} className="task-row">
                        <div className={`checkbox ${milestone.status === 'completed' ? 'checked' : ''}`}></div>
                        <div className="flex-1">
                          <p className={`text-sm font-medium ${milestone.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                            {milestone.name}
                          </p>
                        </div>
                        <div className="text-sm text-gray-500 mr-4">
                          {formatDate(milestone.date)}
                          {milestone.time && <span className="ml-1">at {milestone.time}</span>}
                        </div>
                        <span className={`status-badge ${milestone.status === 'completed' ? 'status-completed' : 'status-pending'}`}>
                          {milestone.status === 'completed' ? 'Done' : 'Pending'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-8 pt-6 border-t text-center text-xs text-gray-400">
          <p>{companySettings?.companyName || 'Company'} | {companySettings?.phone} | {companySettings?.email}</p>
        </div>
      </div>
    </>
  );
}

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  FileText, 
  Receipt, 
  CreditCard,
  Presentation, 
  Image,
  MessageSquare,
  Calendar,
  Clock,
  CheckCircle2,
  Loader2,
  LogOut,
  Phone,
  ArrowRight,
  Home,
  DollarSign,
  Palette,
  MessageCircle,
  ListTodo,
  ChevronRight,
  Eye,
  Download,
  ExternalLink,
  Star,
  Send,
  Music,
  FileEdit,
  Link,
  Sparkles,
  Lightbulb,
  Plus,
  X,
  Trash2,
  Activity,
  PartyPopper,
  Heart,
  Users,
  Camera,
  Gift,
  Cake,
  Target,
  AlertCircle,
  MapPin,
  Banknote,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { OaksyPortalChat } from "@/components/OaksyPortalChat";

interface PortalSession {
  id: string;
  name: string;
  email: string;
  phone: string;
  eventDate: string | null;
  eventType: string | null;
  venue: string | null;
  phase: string;
  assignedPlannerName: string | null;
  assignedPlannerPhone: string | null;
  portalToken?: string;
}

interface SharedEstimate {
  id: string;
  estimateNumber: string;
  title: string;
  total: string;
  status: string;
  sharedAt: string;
  customerName: string;
}

interface SharedPresentation {
  id: string;
  title: string;
  sharedAt: string;
  url?: string;
}

interface TimelineItem {
  id: string;
  phase: number;
  phaseName: string;
  title: string;
  description?: string;
  date?: string;
  time?: string;
  status: string;
  icon?: string;
}

interface ClientInput {
  id: string;
  inputType: string;
  title: string;
  content?: string;
  urls?: string[];
  status: string;
  createdAt: string;
}

interface Feedback {
  id?: string;
  overallRating?: number;
  planningRating?: number;
  executionRating?: number;
  communicationRating?: number;
  decorRating?: number;
  comments?: string;
  suggestions?: string;
  wouldRecommend?: boolean;
  testimonial?: string;
}

interface PortalDashboardData {
  lead: PortalSession;
  estimates: SharedEstimate[];
  presentations: SharedPresentation[];
  timeline: TimelineItem[];
}

const eventFlowSteps = [
  { phase: 1, name: "Enquiry", icon: MessageSquare, description: "Initial contact and requirements discussion" },
  { phase: 2, name: "Planning", icon: FileEdit, description: "Design concepts and estimate preparation" },
  { phase: 3, name: "Booking", icon: CheckCircle2, description: "Contract signing and advance payment" },
  { phase: 4, name: "Preparation", icon: Activity, description: "Vendor coordination and timeline finalization" },
  { phase: 5, name: "Rehearsal", icon: Users, description: "Final walkthrough and confirmations" },
  { phase: 6, name: "Event Day", icon: PartyPopper, description: "The big day celebration" },
  { phase: 7, name: "Memories", icon: Camera, description: "Photos, feedback, and memories" },
];

const inputTypeOptions = [
  { value: 'reference', label: 'Design References', icon: Lightbulb, placeholder: 'Share Pinterest boards, Instagram posts, or any visual inspiration...' },
  { value: 'welcome_board', label: 'Welcome Board Content', icon: FileEdit, placeholder: 'Names, date, venue, taglines, quotes for the welcome board...' },
  { value: 'music', label: 'Music Preferences', icon: Music, placeholder: 'Spotify playlists, song names, or YouTube links...' },
  { value: 'emcee_script', label: 'Emcee Script Details', icon: MessageSquare, placeholder: 'Key announcements, timings, special mentions, jokes...' },
  { value: 'other', label: 'Other Details', icon: Sparkles, placeholder: 'Any other information you want to share...' },
];

function StarRating({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">{label}</Label>
      <div className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="focus:outline-none transition-transform hover:scale-110"
          >
            <Star
              className={`w-9 h-9 ${star <= value ? 'fill-[#4b7c29] text-[#4b7c29]' : 'text-gray-400 stroke-[1.5]'}`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function MyPortal() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  
  const [step, setStep] = useState<'phone' | 'otp' | 'dashboard'>('phone');
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("home");
  
  const [newInput, setNewInput] = useState({ inputType: '', title: '', content: '', urls: [''] });
  const [showAddInput, setShowAddInput] = useState(false);
  
  // Estimate view state
  const [viewingEstimate, setViewingEstimate] = useState<string | null>(null);
  const [estimateData, setEstimateData] = useState<any>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  
  // Timeline roadmap state
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  
  const [feedback, setFeedback] = useState<Feedback>({
    overallRating: 0,
    planningRating: 0,
    executionRating: 0,
    communicationRating: 0,
    decorRating: 0,
    comments: '',
    suggestions: '',
    wouldRecommend: undefined,
    testimonial: '',
  });

  const { data: portalSession, isLoading: sessionLoading, refetch: refetchSession } = useQuery<PortalSession | null>({
    queryKey: ['portal-session'],
    queryFn: async () => {
      const res = await fetch('/api/my-portal/session', { credentials: 'include' });
      if (res.status === 401) return null;
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 0,
  });

  useEffect(() => {
    if (portalSession) {
      setStep('dashboard');
    }
  }, [portalSession]);

  const sendOtpMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await fetch('/api/my-portal/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneNumber }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to send OTP');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setLeadId(data.leadId);
      setStep('otp');
      toast({ title: "OTP Sent", description: "Check your WhatsApp for the verification code" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async ({ leadId, otp }: { leadId: string; otp: string }) => {
      const res = await fetch('/api/my-portal/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId, otp }),
        credentials: 'include',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Invalid OTP');
      }
      return res.json();
    },
    onSuccess: () => {
      refetchSession();
      setStep('dashboard');
      toast({ title: "Welcome!", description: "You're now logged in to your portal" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/my-portal/logout', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Logout failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.clear();
      setStep('phone');
      setPhone("");
      setOtp("");
      setLeadId(null);
      toast({ title: "Logged Out", description: "You've been logged out successfully" });
    },
  });

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery<PortalDashboardData>({
    queryKey: ['portal-dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/my-portal/dashboard', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load dashboard');
      return res.json();
    },
    enabled: step === 'dashboard' && !!portalSession,
  });

  const { data: timelineData } = useQuery<TimelineItem[]>({
    queryKey: ['portal-timeline', portalSession?.portalToken],
    queryFn: async () => {
      if (!portalSession?.portalToken) return [];
      const res = await fetch(`/api/portal/timeline/${portalSession.portalToken}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!portalSession?.portalToken,
  });

  // New milestone-based timeline
  const { data: milestonesData, refetch: refetchMilestones } = useQuery<any>({
    queryKey: ['portal-milestones', portalSession?.portalToken],
    queryFn: async () => {
      if (!portalSession?.portalToken) return null;
      const res = await fetch(`/api/portal/milestones`, {
        headers: { 'Authorization': `Bearer ${portalSession.portalToken}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!portalSession?.portalToken,
  });

  // Event flows (Haldi, Wedding, Sangeet, etc.)
  const { data: eventFlowsData, refetch: refetchEventFlows } = useQuery<any>({
    queryKey: ['portal-event-flows', portalSession?.portalToken],
    queryFn: async () => {
      if (!portalSession?.portalToken) return null;
      const res = await fetch(`/api/portal/event-flows`, {
        headers: { 'Authorization': `Bearer ${portalSession.portalToken}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!portalSession?.portalToken,
  });

  // Financial milestones (payment schedule)
  const { data: financialMilestonesData, refetch: refetchFinancialMilestones } = useQuery<any>({
    queryKey: ['portal-financial-milestones', portalSession?.portalToken],
    queryFn: async () => {
      if (!portalSession?.portalToken) return null;
      const res = await fetch(`/api/portal/financial-milestones`, {
        headers: { 'Authorization': `Bearer ${portalSession.portalToken}` }
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!portalSession?.portalToken,
  });

  const { data: clientInputs, refetch: refetchInputs } = useQuery<ClientInput[]>({
    queryKey: ['portal-client-inputs', portalSession?.portalToken],
    queryFn: async () => {
      if (!portalSession?.portalToken) return [];
      const res = await fetch(`/api/portal/client-inputs/${portalSession.portalToken}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!portalSession?.portalToken,
  });

  const { data: existingFeedback } = useQuery<Feedback | null>({
    queryKey: ['portal-feedback', portalSession?.portalToken],
    queryFn: async () => {
      if (!portalSession?.portalToken) return null;
      const res = await fetch(`/api/portal/feedback/${portalSession.portalToken}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!portalSession?.portalToken,
  });

  useEffect(() => {
    if (existingFeedback) {
      setFeedback({
        ...existingFeedback,
        overallRating: existingFeedback.overallRating || 0,
        planningRating: existingFeedback.planningRating || 0,
        executionRating: existingFeedback.executionRating || 0,
        communicationRating: existingFeedback.communicationRating || 0,
        decorRating: existingFeedback.decorRating || 0,
      });
    }
  }, [existingFeedback]);

  const submitInputMutation = useMutation({
    mutationFn: async (input: { inputType: string; title: string; content: string; urls: string[] }) => {
      const res = await fetch(`/api/portal/client-inputs/${portalSession?.portalToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error('Failed to submit');
      return res.json();
    },
    onSuccess: () => {
      refetchInputs();
      setNewInput({ inputType: '', title: '', content: '', urls: [''] });
      setShowAddInput(false);
      toast({ title: "Submitted!", description: "Your input has been shared with your planner" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit input", variant: "destructive" });
    },
  });

  const deleteInputMutation = useMutation({
    mutationFn: async (inputId: string) => {
      const res = await fetch(`/api/portal/client-inputs/${portalSession?.portalToken}/${inputId}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Failed to delete');
      return res.json();
    },
    onSuccess: () => {
      refetchInputs();
      toast({ title: "Deleted", description: "Input removed successfully" });
    },
  });

  const viewEstimate = async (estimateId: string) => {
    if (!portalSession?.portalToken) return;
    setViewingEstimate(estimateId);
    setEstimateLoading(true);
    try {
      const res = await fetch(`/api/portal/estimate/${estimateId}`, {
        headers: { 'Authorization': `Bearer ${portalSession.portalToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setEstimateData(data);
      } else {
        toast({ title: "Error", description: "Could not load estimate", variant: "destructive" });
        setViewingEstimate(null);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to load estimate", variant: "destructive" });
      setViewingEstimate(null);
    } finally {
      setEstimateLoading(false);
    }
  };

  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedbackData: Feedback) => {
      const res = await fetch(`/api/portal/feedback/${portalSession?.portalToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData),
      });
      if (!res.ok) throw new Error('Failed to submit feedback');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Thank you!", description: "Your feedback has been submitted" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to submit feedback", variant: "destructive" });
    },
  });

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 10) {
      toast({ title: "Invalid Phone", description: "Please enter a valid phone number", variant: "destructive" });
      return;
    }
    sendOtpMutation.mutate(phone);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp || otp.length !== 6) {
      toast({ title: "Invalid OTP", description: "Please enter the 6-digit OTP", variant: "destructive" });
      return;
    }
    if (leadId) {
      verifyOtpMutation.mutate({ leadId, otp });
    }
  };

  const handleSubmitInput = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInput.inputType || !newInput.title) {
      toast({ title: "Required", description: "Please select a type and add a title", variant: "destructive" });
      return;
    }
    const cleanUrls = newInput.urls.filter(u => u.trim());
    submitInputMutation.mutate({ ...newInput, urls: cleanUrls });
  };

  const getCurrentPhase = () => {
    const phaseMap: Record<string, number> = {
      'new': 1,
      'contacted': 1,
      'proposal_sent': 2,
      'negotiation': 2,
      'booked': 3,
      'planning': 4,
      'execution': 5,
      'completed': 7,
    };
    return phaseMap[portalSession?.phase || 'new'] || 1;
  };

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#4b7c29]/10 via-white to-[#4b7c29]/5">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-[#4b7c29] to-[#3d6621] rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-2xl">O</span>
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-[#4b7c29] mx-auto" />
        </div>
      </div>
    );
  }

  if (step === 'phone') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#4b7c29]/10 via-white to-[#4b7c29]/5 p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-[#4b7c29] to-[#6ba33d]" />
          <CardHeader className="text-center pt-8">
            <div className="w-20 h-20 bg-gradient-to-br from-[#4b7c29] to-[#3d6621] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <span className="text-white font-bold text-3xl">O</span>
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-[#4b7c29] to-[#3d6621] bg-clip-text text-transparent">
              Welcome to Your Portal
            </CardTitle>
            <CardDescription className="text-gray-600">
              Enter your phone number to access your event details
            </CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-gray-700">Phone Number</Label>
                <div className="flex gap-2">
                  <div className="flex items-center px-4 bg-gradient-to-r from-gray-100 to-gray-50 rounded-lg border">
                    <span className="text-sm font-medium text-gray-600">+91</span>
                  </div>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="Enter your phone number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="flex-1 h-12 text-lg"
                    data-testid="input-phone"
                  />
                </div>
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-[#4b7c29] to-[#3d6621] hover:from-[#3d6621] hover:to-[#2d5018] text-lg font-medium shadow-lg"
                disabled={sendOtpMutation.isPending}
                data-testid="button-send-otp"
              >
                {sendOtpMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <Phone className="w-5 h-5 mr-2" />
                )}
                Send OTP via WhatsApp
              </Button>
            </form>
            <p className="text-xs text-center text-gray-500 mt-6">
              You'll receive a verification code on your WhatsApp
            </p>
          </CardContent>
        </Card>
        <OaksyPortalChat chatType="landing" />
      </div>
    );
  }

  if (step === 'otp') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#4b7c29]/10 via-white to-[#4b7c29]/5 p-4">
        <Card className="w-full max-w-md border-0 shadow-2xl overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-[#4b7c29] to-[#6ba33d]" />
          <CardHeader className="text-center pt-8">
            <div className="w-20 h-20 bg-gradient-to-br from-[#4b7c29] to-[#3d6621] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              <MessageSquare className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold">Enter Verification Code</CardTitle>
            <CardDescription>We sent a 6-digit code to your WhatsApp</CardDescription>
          </CardHeader>
          <CardContent className="pb-8">
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="otp">Verification Code</Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="Enter 6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="text-center text-3xl tracking-[0.5em] h-14 font-mono"
                  maxLength={6}
                  data-testid="input-otp"
                />
              </div>
              <Button 
                type="submit" 
                className="w-full h-12 bg-gradient-to-r from-[#4b7c29] to-[#3d6621] hover:from-[#3d6621] hover:to-[#2d5018] text-lg font-medium shadow-lg"
                disabled={verifyOtpMutation.isPending}
                data-testid="button-verify-otp"
              >
                {verifyOtpMutation.isPending ? (
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="w-5 h-5 mr-2" />
                )}
                Verify & Continue
              </Button>
            </form>
            <Button 
              variant="ghost" 
              className="w-full mt-2"
              onClick={() => { setStep('phone'); setOtp(""); }}
            >
              Change Phone Number
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const navItems = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'timeline', label: 'Timeline', icon: Clock, highlight: true },
    { id: 'eventflow', label: 'Event Flow', icon: Activity },
    { id: 'financials', label: 'Financials', icon: DollarSign },
    { id: 'creatives', label: 'Creatives', icon: Palette },
    { id: 'inputs', label: 'Your Inputs', icon: Lightbulb },
    { id: 'feedback', label: 'Feedback', icon: MessageCircle },
  ];

  const formatEventType = (eventType: string | null): string => {
    if (!eventType) return 'Not specified';
    return eventType
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getProgressStageLabel = (percentage: number): string => {
    if (percentage === 0) return 'Getting Started';
    if (percentage < 15) return 'Early Planning';
    if (percentage < 30) return 'Phase 1 Complete';
    if (percentage < 50) return 'Planning Underway';
    if (percentage < 70) return 'Mid-Planning';
    if (percentage < 85) return 'Final Stages';
    if (percentage < 100) return 'Almost There';
    return 'All Complete';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-[#4b7c29]/5">
      <header className="bg-white/80 backdrop-blur-md border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src="/oakstreet-icon-192.png" 
              alt="Oakstreet Events" 
              className="h-10 w-10 object-contain rounded-full"
            />
            <div>
              <h1 className="font-semibold text-gray-900">Oakstreet Events</h1>
              <p className="text-xs text-gray-500">Client Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600 hidden sm:block font-medium">{portalSession?.name}</span>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => logoutMutation.mutate()}
              className="text-gray-600 hover:text-red-600"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <nav className="bg-white/60 backdrop-blur-sm border-b sticky top-[57px] z-40">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide py-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium rounded-t-lg transition-all whitespace-nowrap ${
                  activeTab === item.id
                    ? 'bg-gradient-to-r from-[#4b7c29] to-[#3d6621] text-white shadow-md'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {dashboardLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#4b7c29]" />
          </div>
        ) : (
          <>
            {activeTab === 'home' && (
              <div className="space-y-6 animate-fadeIn">
                <Card className="border-0 shadow-xl overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-[#4b7c29] via-[#6ba33d] to-[#4b7c29]" />
                  <CardHeader className="bg-gradient-to-br from-[#4b7c29]/5 to-white">
                    <CardTitle className="text-2xl flex items-center gap-2">
                      <Heart className="w-6 h-6 text-[#4b7c29]" />
                      Welcome, {portalSession?.name}!
                    </CardTitle>
                    <CardDescription>Here's an overview of your special event</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="p-4 bg-gradient-to-br from-[#4b7c29]/10 to-white rounded-xl border border-[#4b7c29]/20 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <PartyPopper className="w-4 h-4 text-[#4b7c29]" />
                          <p className="text-xs text-[#4b7c29] uppercase font-semibold">Event Type</p>
                        </div>
                        <p className="font-semibold text-gray-900">{formatEventType(portalSession?.eventType)}</p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-[#4b7c29]/10 to-white rounded-xl border border-[#4b7c29]/20 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Calendar className="w-4 h-4 text-[#4b7c29]" />
                          <p className="text-xs text-[#4b7c29] uppercase font-semibold">Event Date</p>
                        </div>
                        <p className="font-semibold text-gray-900">
                          {portalSession?.eventDate 
                            ? format(new Date(portalSession.eventDate), 'MMM dd, yyyy')
                            : 'Not set'}
                        </p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-[#4b7c29]/10 to-white rounded-xl border border-[#4b7c29]/20 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Home className="w-4 h-4 text-[#4b7c29]" />
                          <p className="text-xs text-[#4b7c29] uppercase font-semibold">Venue</p>
                        </div>
                        <p className="font-semibold text-gray-900">{portalSession?.venue || 'Not specified'}</p>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-[#4b7c29]/10 to-white rounded-xl border border-[#4b7c29]/20 shadow-sm">
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-[#4b7c29]" />
                          <p className="text-xs text-[#4b7c29] uppercase font-semibold">Your Planner</p>
                        </div>
                        <p className="font-semibold text-gray-900">{portalSession?.assignedPlannerName || 'To be assigned'}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Smart Engagement Widgets Row */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {/* Event Countdown Widget */}
                  {portalSession?.eventDate && (
                    <Card className="border-0 shadow-lg bg-gradient-to-br from-[#5a8a35] to-[#4b7c29] text-white overflow-hidden min-h-[140px]" data-testid="countdown-widget">
                      <CardContent className="p-5 h-full flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-3">
                          <Clock className="w-5 h-5 opacity-90" />
                          <span className="text-sm font-medium opacity-90">Countdown</span>
                        </div>
                        {(() => {
                          const eventDate = new Date(portalSession.eventDate);
                          const now = new Date();
                          const diff = eventDate.getTime() - now.getTime();
                          const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
                          const hours = Math.max(0, Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));
                          return (
                            <div className="flex items-baseline gap-2">
                              <span className="text-4xl font-semibold" data-testid="text-countdown-days">{days}</span>
                              <span className="text-sm opacity-80">days</span>
                              <span className="text-2xl font-medium ml-2" data-testid="text-countdown-hours">{hours}</span>
                              <span className="text-sm opacity-80">hrs</span>
                            </div>
                          );
                        })()}
                        <p className="text-xs opacity-70 mt-2">Until your special day</p>
                      </CardContent>
                    </Card>
                  )}

                  {/* Progress Summary Widget */}
                  <Card className="border-0 shadow-lg overflow-hidden min-h-[140px]" data-testid="progress-summary-widget">
                    <CardContent className="p-5 h-full flex flex-col justify-between">
                      <div className="flex items-center gap-2 mb-3">
                        <Target className="w-5 h-5 text-[#4b7c29]" />
                        <span className="text-sm font-medium text-[#3d6622]/80">Planning Progress</span>
                      </div>
                      {(() => {
                        const percentage = milestonesData?.progress?.percentage || 0;
                        const stageLabel = getProgressStageLabel(percentage);
                        return (
                          <>
                            <div className="mb-2">
                              <p className="text-xl font-bold text-[#4b7c29]" data-testid="text-progress-stage">{stageLabel}</p>
                              <p className="text-sm text-[#4b7c29]/60" data-testid="text-progress-percentage">{percentage}% complete</p>
                            </div>
                            <div className="w-full bg-[#4b7c29]/10 rounded-xl h-3.5">
                              <div 
                                className="bg-[#4b7c29] h-3.5 rounded-xl transition-all duration-1000 ease-out" 
                                style={{ width: `${percentage}%` }}
                                data-testid="progress-bar"
                              />
                            </div>
                          </>
                        );
                      })()}
                    </CardContent>
                  </Card>

                  {/* Action Required Panel */}
                  {milestonesData?.pendingApprovals > 0 && (
                    <Card className="border-0 shadow-lg border-l-4 border-l-[#4b7c29] overflow-hidden" data-testid="action-required-panel">
                      <CardContent className="p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle className="w-5 h-5 text-[#4b7c29]" />
                          <span className="text-sm font-medium text-[#3d6622]">Action Required</span>
                        </div>
                        <p className="text-2xl font-bold text-[#3d6622] mb-1" data-testid="text-pending-count">{milestonesData.pendingApprovals} pending</p>
                        <p className="text-xs text-[#4b7c29]/60 mb-3">Tasks awaiting your review</p>
                        <Button 
                          size="sm" 
                          className="w-full bg-[#4b7c29] hover:bg-[#3d6622] text-white"
                          onClick={() => setActiveTab('timeline')}
                          data-testid="button-complete-now"
                        >
                          Complete Now
                        </Button>
                      </CardContent>
                    </Card>
                  )}

                  {/* Event Manager Contact Card */}
                  {portalSession?.assignedPlannerName && (
                    <Card className="border-0 shadow-lg overflow-hidden min-h-[140px]" data-testid="planner-contact-card">
                      <CardContent className="p-5 h-full flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-3">
                          <Users className="w-5 h-5 text-[#4b7c29]" />
                          <span className="text-sm font-medium text-[#3d6622]/80">Your Planner</span>
                        </div>
                        <p className="font-semibold text-[#3d6622] mb-3" data-testid="text-planner-name">{portalSession.assignedPlannerName}</p>
                        <div className="flex gap-3">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1 border-[#4b7c29] text-[#4b7c29] hover:bg-[#4b7c29]/10 h-8"
                            data-testid="button-call-planner"
                            onClick={() => {
                              if (portalSession?.assignedPlannerPhone) {
                                window.location.href = `tel:${portalSession.assignedPlannerPhone}`;
                              } else {
                                toast({ title: "Contact unavailable", description: "Planner phone number not available", variant: "destructive" });
                              }
                            }}
                          >
                            <Phone className="w-3.5 h-3.5 mr-1" /> Call
                          </Button>
                          <Button 
                            size="sm" 
                            className="flex-1 bg-[#4b7c29] hover:bg-[#3d6622] text-white h-8"
                            data-testid="button-whatsapp-planner"
                            onClick={() => {
                              if (portalSession?.assignedPlannerPhone) {
                                const phone = portalSession.assignedPlannerPhone.replace(/\D/g, '');
                                window.open(`https://wa.me/${phone}`, '_blank');
                              } else {
                                toast({ title: "Contact unavailable", description: "Planner phone number not available", variant: "destructive" });
                              }
                            }}
                          >
                            <MessageCircle className="w-3.5 h-3.5 mr-1" /> WhatsApp
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>

                {/* Recent Activity Feed - Dynamic from milestones data */}
                <Card className="border-0 shadow-lg overflow-hidden" data-testid="recent-activity-feed">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-[#4b7c29]" />
                        <span className="font-semibold text-[#3d6622]">Recent Activity</span>
                      </div>
                      <span className="text-xs text-[#4b7c29]/50">Latest updates</span>
                    </div>
                    <div className="space-y-3">
                      {/* Dynamic activity entries from phases/tasks */}
                      {(() => {
                        const activities: Array<{action: string, time: string, icon: any}> = [];
                        
                        // Get completed tasks from milestones
                        if (milestonesData?.phases) {
                          milestonesData.phases.forEach((phase: any) => {
                            if (phase.tasks) {
                              phase.tasks.filter((t: any) => t.isCompleted).forEach((task: any) => {
                                activities.push({
                                  action: `${task.taskName} completed`,
                                  time: 'Recently',
                                  icon: CheckCircle2
                                });
                              });
                            }
                          });
                        }
                        
                        // Show empty state if no activities
                        if (activities.length === 0) {
                          return (
                            <div className="text-center py-6" data-testid="activity-empty-state">
                              <RefreshCw className="w-8 h-8 text-[#4b7c29]/30 mx-auto mb-2" />
                              <p className="text-sm text-[#4b7c29]/60">No recent updates yet</p>
                              <p className="text-xs text-[#4b7c29]/40 mt-1">Activity will appear here as your planning progresses</p>
                            </div>
                          );
                        }
                        
                        return activities.slice(0, 3).map((activity, idx) => (
                          <div 
                            key={idx} 
                            className="flex items-center gap-3 p-3 rounded-lg bg-[#4b7c29]/[0.03] hover:bg-[#4b7c29]/[0.06] transition-colors"
                            data-testid={`activity-item-${idx}`}
                          >
                            <div className="relative">
                              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-[#4b7c29]/10 text-[#4b7c29]">
                                <activity.icon className="w-4 h-4" />
                              </div>
                              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#4b7c29] border-2 border-white" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-[#3d6622]" data-testid={`activity-text-${idx}`}>{activity.action}</p>
                            </div>
                            <span className="text-xs text-[#4b7c29]/50" data-testid={`activity-time-${idx}`}>{activity.time}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Downloads */}
                <Card className="border-0 shadow-lg overflow-hidden" data-testid="quick-downloads-card">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Download className="w-5 h-5 text-[#4b7c29]" />
                      <span className="font-semibold text-[#3d6622]">Quick Downloads</span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Button 
                        variant="outline" 
                        className="flex flex-col items-center gap-2 h-auto py-4 border-[#4b7c29]/30 hover:bg-[#4b7c29]/5 hover:border-[#4b7c29]"
                        onClick={() => setActiveTab('eventflow')}
                        data-testid="button-download-event-plan"
                      >
                        <FileText className="w-6 h-6 text-[#4b7c29]" />
                        <span className="text-xs text-[#3d6622]/70">Event Plan</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex flex-col items-center gap-2 h-auto py-4 border-[#4b7c29]/30 hover:bg-[#4b7c29]/5 hover:border-[#4b7c29]"
                        onClick={() => setActiveTab('financials')}
                        data-testid="button-download-estimate"
                      >
                        <Receipt className="w-6 h-6 text-[#4b7c29]" />
                        <span className="text-xs text-[#3d6622]/70">Estimate</span>
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex flex-col items-center gap-2 h-auto py-4 border-[#4b7c29]/30 hover:bg-[#4b7c29]/5 hover:border-[#4b7c29]"
                        onClick={() => setActiveTab('timeline')}
                        data-testid="button-download-schedule"
                      >
                        <Calendar className="w-6 h-6 text-[#4b7c29]" />
                        <span className="text-xs text-[#3d6622]/70">Schedule</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {navItems.slice(1).map((item: any) => (
                    <Card 
                      key={item.id}
                      className={`cursor-pointer hover:shadow-xl transition-all duration-300 hover:-translate-y-1 shadow-lg overflow-hidden group ${
                        item.highlight 
                          ? 'border-2 border-[#4b7c29] ring-2 ring-[#4b7c29]/20' 
                          : 'border-0'
                      }`}
                      onClick={() => setActiveTab(item.id)}
                    >
                      <div className={`h-1 ${item.highlight ? 'bg-[#4b7c29]' : 'bg-gradient-to-r from-[#4b7c29] to-[#4b7c29]/60'}`} />
                      <CardContent className="p-5 flex items-center gap-4">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-md transition-transform group-hover:scale-110 ${
                          item.highlight 
                            ? 'bg-[#4b7c29] text-white' 
                            : 'bg-gradient-to-br from-[#4b7c29]/10 to-[#4b7c29]/20'
                        }`}>
                          <item.icon className={`w-7 h-7 ${item.highlight ? 'text-white' : 'text-[#4b7c29]'}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-[#3d6622]">{item.label}</p>
                            {item.highlight && (
                              <span className="text-[10px] font-semibold bg-[#4b7c29] text-white px-2 py-0.5 rounded-full">Primary</span>
                            )}
                          </div>
                          <p className="text-xs text-[#4b7c29]/60">View details</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-[#4b7c29]/50 group-hover:text-[#4b7c29] transition-colors" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'eventflow' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Event Flows Header */}
                <Card className="border-0 shadow-xl overflow-hidden bg-white">
                  <div className="h-1 bg-gradient-to-r from-[#4b7c29] via-[#6da035] to-[#4b7c29]" />
                  <CardHeader className="bg-gradient-to-br from-green-50/50 to-white">
                    <CardTitle className="flex items-center gap-2 text-[#4b7c29]">
                      <Activity className="w-5 h-5" />
                      Your Event Flow
                    </CardTitle>
                    <CardDescription className="text-gray-600">Your events and their detailed schedules</CardDescription>
                  </CardHeader>
                </Card>

                {/* Event Flow Cards */}
                {eventFlowsData?.eventFlows && eventFlowsData.eventFlows.length > 0 ? (
                  <div className="space-y-6">
                    {eventFlowsData.eventFlows.map((eventFlow: any, flowIdx: number) => (
                      <Card 
                        key={eventFlow.id} 
                        className="border-0 shadow-xl overflow-hidden bg-white animate-slideIn"
                        style={{ animationDelay: `${flowIdx * 150}ms` }}
                        data-testid={`event-flow-${eventFlow.id}`}
                      >
                        {/* Event Header */}
                        <div className="bg-gradient-to-r from-[#4b7c29] to-[#3d6621] p-6 text-white">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-2xl font-bold">{eventFlow.eventName}</h3>
                              {eventFlow.venue && (
                                <p className="text-white/80 mt-1 flex items-center gap-1">
                                  <MapPin className="w-4 h-4" /> {eventFlow.venue}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              {/* Download Excel Button */}
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-white/20 border-white/40 text-white hover:bg-white/30"
                                onClick={() => {
                                  const token = portalSession?.portalToken;
                                  if (token) {
                                    window.open(`/api/portal/event-flows/${eventFlow.id}/download-excel?token=${token}`, '_blank');
                                  }
                                }}
                                data-testid={`button-download-excel-${eventFlow.id}`}
                              >
                                <Download className="w-4 h-4 mr-1" />
                                Download Excel
                              </Button>
                              {eventFlow.eventDate && (
                                <div className="text-right bg-white/20 backdrop-blur-sm rounded-xl p-4">
                                  <div className="text-3xl font-bold">{format(new Date(eventFlow.eventDate), 'dd')}</div>
                                  <div className="text-sm uppercase tracking-wide">{format(new Date(eventFlow.eventDate), 'MMM yyyy')}</div>
                                  {eventFlow.eventTime && <div className="text-xs mt-1">{eventFlow.eventTime}</div>}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Event Flow Items (Timeline) */}
                        <CardContent className="p-6 bg-white">
                          {eventFlow.items && eventFlow.items.length > 0 ? (
                            <div className="relative">
                              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gradient-to-b from-[#4b7c29] to-gray-200" />
                              <div className="space-y-4">
                                {eventFlow.items.map((item: any, itemIdx: number) => (
                                  <div 
                                    key={item.id}
                                    className="flex gap-4 ml-1 animate-fadeIn"
                                    style={{ animationDelay: `${itemIdx * 80}ms` }}
                                    data-testid={`flow-item-${item.id}`}
                                  >
                                    <div className="w-6 h-6 rounded-full bg-white border-2 border-[#4b7c29] flex items-center justify-center z-10 shadow-sm">
                                      <div className="w-2 h-2 rounded-full bg-[#4b7c29]" />
                                    </div>
                                    <div className="flex-1 bg-green-50/50 border border-green-100 rounded-xl p-4 hover:shadow-md transition-all">
                                      <div className="flex items-center justify-between">
                                        <h4 className="font-semibold text-gray-800">{item.title}</h4>
                                        {item.startTime && (
                                          <Badge className="bg-[#4b7c29]/10 text-[#4b7c29] border-0">
                                            <Clock className="w-3 h-3 mr-1" />
                                            {item.startTime}{item.endTime && ` - ${item.endTime}`}
                                          </Badge>
                                        )}
                                      </div>
                                      {item.description && (
                                        <p className="text-sm text-gray-600 mt-2">{item.description}</p>
                                      )}
                                      {item.category && (
                                        <Badge variant="outline" className="mt-2 text-xs border-green-200 text-green-700">
                                          {item.category}
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-center py-8 text-gray-500">
                              <Clock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                              <p>Schedule coming soon</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  /* Empty State */
                  <Card className="border-0 shadow-xl overflow-hidden bg-white">
                    <CardContent className="py-16 text-center">
                      <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Activity className="w-10 h-10 text-[#4b7c29]" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-700 mb-2">Event Flow Coming Soon</h3>
                      <p className="text-gray-500 max-w-md mx-auto">
                        Your wedding planner will share the detailed event schedule including Haldi, Sangeet, Wedding, and more. Stay tuned!
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'financials' && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#4b7c29]" /> Estimates
                  </h2>
                  {dashboardData?.estimates && dashboardData.estimates.length > 0 ? (
                    <div className="grid gap-4">
                      {dashboardData.estimates.map((est) => (
                        <Card key={est.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0 mr-4">
                                <p 
                                  className="font-semibold text-gray-900 line-clamp-2" 
                                  title={est.title || est.estimateNumber}
                                >
                                  {est.title || est.estimateNumber}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {est.estimateNumber} • Shared {format(new Date(est.sharedAt), 'MMM dd, yyyy')}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="font-bold text-xl text-[#4b7c29]">
                                  ₹{parseFloat(est.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </p>
                                <Badge 
                                  variant={est.status === 'approved' ? 'default' : 'secondary'} 
                                  className={`mt-1 text-[11px] px-3 py-1 tracking-wide flex items-center justify-center ${
                                    est.status === 'converted' || est.status === 'approved'
                                      ? 'bg-[#3d6622] text-white font-semibold'
                                      : 'bg-[#4b7c29]/15 text-[#2d4a1a] font-medium'
                                  }`}
                                >
                                  {est.status.charAt(0).toUpperCase() + est.status.slice(1)}
                                </Badge>
                              </div>
                            </div>
                            <div className="mt-4 flex gap-2">
                              <Button 
                                size="sm" 
                                className="bg-[#4b7c29] hover:bg-[#3d6621]"
                                onClick={() => viewEstimate(est.id)}
                              >
                                <Eye className="w-4 h-4 mr-1" /> View
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="border-[#4b7c29] text-[#4b7c29] hover:bg-[#4b7c29]/10"
                                onClick={() => {
                                  window.open(`/print/quote/${est.id}?download=true&portalToken=${portalSession?.portalToken}`, '_blank');
                                }}
                              >
                                <Download className="w-4 h-4 mr-1" /> Download
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="border-0 shadow-lg">
                      <CardContent className="p-12 text-center">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <FileText className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="font-medium text-gray-600">No estimates shared yet</p>
                        <p className="text-sm text-gray-400 mt-1">Your wedding planner will share estimates here</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <Separator className="my-6" />

                <div>
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-[#4b7c29]" /> Invoices
                  </h2>
                  <Card className="border-0 shadow-lg">
                    <CardContent className="p-12 text-center">
                      <div className="w-16 h-16 bg-[#4b7c29]/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Receipt className="w-8 h-8 text-[#4b7c29]/50" />
                      </div>
                      <p className="font-medium text-[#3d6622]">No invoices yet</p>
                      <p className="text-sm text-[#4b7c29]/50 mt-1">Invoices will appear here after booking confirmation</p>
                    </CardContent>
                  </Card>
                </div>

                <Separator className="my-6" />

                <div>
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Banknote className="w-5 h-5 text-[#4b7c29]" /> Payment Milestones 💰
                  </h2>
                  
                  {financialMilestonesData?.milestones && financialMilestonesData.milestones.length > 0 ? (
                    <div className="space-y-4">
                      {/* Payment Summary Card - Reduced height */}
                      <Card className="border-0 shadow-lg bg-gradient-to-r from-[#5a8a35] to-[#4b7c29] text-white">
                        <CardContent className="p-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
                            <div>
                              <p className="text-white/70 text-xs">Total Value</p>
                              <p className="text-lg font-bold">₹{financialMilestonesData.summary.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div>
                              <p className="text-white/70 text-xs">Paid</p>
                              <p className="text-lg font-bold">₹{financialMilestonesData.summary.paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div>
                              <p className="text-white/70 text-xs">Pending</p>
                              <p className="text-lg font-bold">₹{financialMilestonesData.summary.pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                            </div>
                            <div>
                              <p className="text-white/70 text-xs">Progress</p>
                              <p className="text-lg font-bold">{financialMilestonesData.summary.completedMilestones}/{financialMilestonesData.summary.totalMilestones}</p>
                            </div>
                          </div>
                          <div className="w-full bg-white/20 rounded-full h-3 mt-3">
                            <div 
                              className="bg-white h-3 rounded-full transition-all duration-1000 ease-out" 
                              style={{ width: `${(financialMilestonesData.summary.paidAmount / financialMilestonesData.summary.totalAmount) * 100}%` }}
                            />
                          </div>
                        </CardContent>
                      </Card>

                      {/* Payment Milestones List */}
                      <div className="space-y-3">
                        {financialMilestonesData.milestones.map((milestone: any, idx: number) => {
                          const isOverdue = milestone.dueDate && !milestone.isPaid && new Date(milestone.dueDate) < new Date();
                          const isDueSoon = milestone.dueDate && !milestone.isPaid && !isOverdue && 
                            (new Date(milestone.dueDate).getTime() - new Date().getTime()) < (7 * 24 * 60 * 60 * 1000);
                          
                          const getStatusColor = () => {
                            if (milestone.isPaid) return 'bg-green-100 text-green-700';
                            if (isOverdue) return 'bg-red-100 text-red-700';
                            if (isDueSoon) return 'bg-orange-100 text-orange-700';
                            return 'bg-gray-100 text-gray-600';
                          };
                          
                          const getStatusText = () => {
                            if (milestone.isPaid) return 'Paid';
                            if (isOverdue) return 'Overdue';
                            if (isDueSoon) return 'Due Soon';
                            return 'Pending';
                          };
                          
                          return (
                            <Card 
                              key={milestone.id} 
                              className={`border-0 shadow-lg animate-slideIn overflow-hidden ${
                                milestone.isPaid ? 'bg-green-50 ring-2 ring-green-200' : 
                                isOverdue ? 'bg-red-50 ring-2 ring-red-200' :
                                isDueSoon ? 'ring-2 ring-orange-200' : 'bg-white'
                              }`}
                              style={{ animationDelay: `${idx * 100}ms` }}
                              data-testid={`payment-milestone-${milestone.id}`}
                            >
                              <CardContent className="p-5">
                                <div className="flex items-center gap-4">
                                  <div className={`relative w-14 h-14 rounded-full flex items-center justify-center ${
                                    milestone.isPaid 
                                      ? 'bg-green-500' 
                                      : isOverdue ? 'bg-red-100 border-[3px] border-red-400'
                                      : isDueSoon ? 'bg-orange-100 border-[3px] border-orange-400'
                                      : 'bg-gray-100 border-[3px] border-dashed border-gray-300'
                                  }`}>
                                    {milestone.isPaid ? (
                                      <CheckCircle2 className="w-7 h-7 text-white" />
                                    ) : (
                                      <span className={`text-lg font-bold ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-orange-600' : 'text-gray-400'}`}>
                                        {milestone.percentage}%
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="font-semibold text-gray-800">{milestone.milestoneName}</h4>
                                      <Badge className={getStatusColor()}>
                                        {getStatusText()}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-gray-500 mt-1">{milestone.dueDescription}</p>
                                    {milestone.dueDate && !milestone.isPaid && (
                                      <div className={`inline-flex items-center gap-1.5 mt-2 px-2 py-1 rounded-md ${
                                        isOverdue ? 'bg-red-100' : isDueSoon ? 'bg-orange-100' : 'bg-gray-100'
                                      }`}>
                                        <Calendar className={`w-3.5 h-3.5 ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-orange-600' : 'text-gray-500'}`} />
                                        <span className={`text-xs font-semibold ${isOverdue ? 'text-red-700' : isDueSoon ? 'text-orange-700' : 'text-gray-600'}`}>
                                          Due: {format(new Date(milestone.dueDate), 'MMM dd, yyyy')}
                                        </span>
                                      </div>
                                    )}
                                    {milestone.isPaid && milestone.paidAt && (
                                      <p className="text-xs text-green-600 mt-2 font-medium">Paid on {format(new Date(milestone.paidAt), 'MMM dd, yyyy')}</p>
                                    )}
                                  </div>
                                  <div className="text-right flex flex-col items-end gap-2">
                                    <p className={`text-xl font-bold ${milestone.isPaid ? 'text-green-600' : 'text-[#4b7c29]'}`}>
                                      ₹{parseFloat(milestone.amount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                    <p className="text-xs text-gray-400">{milestone.percentage}% of total</p>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <Card className="border-0 shadow-lg bg-white">
                      <CardContent className="p-12 text-center">
                        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Banknote className="w-8 h-8 text-[#4b7c29]" />
                        </div>
                        <p className="font-medium text-gray-600">Payment milestones coming soon</p>
                        <p className="text-sm text-gray-400 mt-1">Your planner will set up your payment schedule here</p>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'creatives' && (
              <div className="space-y-6 animate-fadeIn">
                <div>
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Presentation className="w-5 h-5 text-pink-600" /> Presentations
                  </h2>
                  {dashboardData?.presentations && dashboardData.presentations.length > 0 ? (
                    <div className="grid gap-4">
                      {dashboardData.presentations.map((pres) => (
                        <Card key={pres.id} className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                          <CardContent className="p-5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-gradient-to-br from-pink-100 to-pink-200 rounded-lg flex items-center justify-center">
                                <Presentation className="w-6 h-6 text-pink-600" />
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{pres.title}</p>
                                <p className="text-sm text-gray-500">
                                  Shared {format(new Date(pres.sharedAt), 'MMM dd, yyyy')}
                                </p>
                              </div>
                            </div>
                            {pres.url ? (
                              <Button size="sm" className="bg-pink-600 hover:bg-pink-700" asChild>
                                <a href={pres.url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-4 h-4 mr-1" /> Open
                                </a>
                              </Button>
                            ) : (
                              <Button size="sm" variant="outline" disabled>
                                <Eye className="w-4 h-4 mr-1" /> Coming Soon
                              </Button>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <Card className="border-0 shadow-lg">
                      <CardContent className="p-12 text-center">
                        <div className="w-16 h-16 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Presentation className="w-8 h-8 text-pink-400" />
                        </div>
                        <p className="font-medium text-gray-600">No presentations shared yet</p>
                        <p className="text-sm text-gray-400 mt-1">Design presentations will appear here</p>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <Separator className="my-6" />

                <div>
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Image className="w-5 h-5 text-purple-600" /> Photos
                  </h2>
                  <Card className="border-0 shadow-lg">
                    <CardContent className="p-12 text-center">
                      <div className="w-16 h-16 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Camera className="w-8 h-8 text-purple-400" />
                      </div>
                      <p className="font-medium text-gray-600">No photos shared yet</p>
                      <p className="text-sm text-gray-400 mt-1">Event photos will be shared here</p>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activeTab === 'inputs' && (
              <div className="space-y-6 animate-fadeIn">
                <Card className="border-0 shadow-xl overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-[#5a8a35] via-[#4b7c29] to-[#5a8a35]" />
                  <CardHeader className="bg-gradient-to-br from-[#4b7c29]/5 to-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Lightbulb className="w-5 h-5 text-[#4b7c29]" />
                          Your Creative Inputs
                        </CardTitle>
                        <CardDescription>Share your ideas, preferences, and inspiration with your planner</CardDescription>
                        <div className="mt-3 h-px bg-gradient-to-r from-transparent via-[#4b7c29]/20 to-transparent" />
                      </div>
                      <Button 
                        onClick={() => setShowAddInput(true)}
                        variant="outline"
                        className="border-[#4b7c29] text-[#4b7c29] hover:bg-[#4b7c29]/10"
                        data-testid="button-add-input"
                      >
                        <Plus className="w-4 h-4 mr-1" /> Add Input
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    {showAddInput && (
                      <Card className="mb-6 border-2 border-[#4b7c29]/30 bg-[#4b7c29]/5">
                        <CardContent className="p-4">
                          <form onSubmit={handleSubmitInput} className="space-y-4">
                            <div>
                              <Label className="text-sm font-medium">Category</Label>
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                                {inputTypeOptions.map((opt) => (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setNewInput({ ...newInput, inputType: opt.value })}
                                    className={`p-3 rounded-lg border text-left transition-all ${
                                      newInput.inputType === opt.value 
                                        ? 'border-[#4b7c29] bg-[#4b7c29]/15 shadow-md' 
                                        : 'border-gray-200 hover:border-[#4b7c29]/50'
                                    }`}
                                  >
                                    <opt.icon className={`w-5 h-5 mb-1 ${newInput.inputType === opt.value ? 'text-[#4b7c29]' : 'text-gray-400'}`} />
                                    <p className="text-sm font-medium">{opt.label}</p>
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div>
                              <Label htmlFor="inputTitle">Title</Label>
                              <Input
                                id="inputTitle"
                                placeholder="e.g., Pinterest Board for Table Decor"
                                value={newInput.title}
                                onChange={(e) => setNewInput({ ...newInput, title: e.target.value })}
                                className="mt-1"
                              />
                            </div>
                            <div>
                              <Label htmlFor="inputContent">Details</Label>
                              <Textarea
                                id="inputContent"
                                placeholder={inputTypeOptions.find(o => o.value === newInput.inputType)?.placeholder || 'Add your details here...'}
                                value={newInput.content}
                                onChange={(e) => setNewInput({ ...newInput, content: e.target.value })}
                                className="mt-1 min-h-[100px]"
                              />
                            </div>
                            <div>
                              <Label>Links (optional)</Label>
                              {newInput.urls.map((url, idx) => (
                                <div key={idx} className="flex gap-2 mt-2">
                                  <Input
                                    placeholder="https://..."
                                    value={url}
                                    onChange={(e) => {
                                      const newUrls = [...newInput.urls];
                                      newUrls[idx] = e.target.value;
                                      setNewInput({ ...newInput, urls: newUrls });
                                    }}
                                  />
                                  {idx === newInput.urls.length - 1 ? (
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      size="icon"
                                      onClick={() => setNewInput({ ...newInput, urls: [...newInput.urls, ''] })}
                                    >
                                      <Plus className="w-4 h-4" />
                                    </Button>
                                  ) : (
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      size="icon"
                                      onClick={() => {
                                        const newUrls = newInput.urls.filter((_, i) => i !== idx);
                                        setNewInput({ ...newInput, urls: newUrls });
                                      }}
                                    >
                                      <X className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="flex gap-2 pt-2">
                              <Button 
                                type="submit" 
                                className="bg-[#4b7c29] hover:bg-[#3d6622]"
                                disabled={submitInputMutation.isPending}
                              >
                                {submitInputMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                ) : (
                                  <Send className="w-4 h-4 mr-1" />
                                )}
                                Submit
                              </Button>
                              <Button 
                                type="button" 
                                variant="outline"
                                className="border-[#4b7c29]/50 text-[#4b7c29] hover:bg-[#4b7c29]/10"
                                onClick={() => {
                                  setShowAddInput(false);
                                  setNewInput({ inputType: '', title: '', content: '', urls: [''] });
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </CardContent>
                      </Card>
                    )}

                    {clientInputs && clientInputs.length > 0 ? (
                      <div className="space-y-4">
                        {clientInputs.map((input) => {
                          const typeInfo = inputTypeOptions.find(o => o.value === input.inputType);
                          const Icon = typeInfo?.icon || Sparkles;
                          return (
                            <Card key={input.id} className="border shadow-sm hover:shadow-md transition-shadow">
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between">
                                  <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 bg-[#4b7c29]/10 rounded-lg flex items-center justify-center">
                                      <Icon className="w-5 h-5 text-[#4b7c29]" />
                                    </div>
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2">
                                        <h4 className="font-semibold text-gray-900">{input.title}</h4>
                                        <Badge variant={input.status === 'reviewed' ? 'default' : input.status === 'approved' ? 'outline' : 'secondary'} className="text-xs">
                                          {input.status}
                                        </Badge>
                                      </div>
                                      <p className="text-xs text-gray-500 mt-1">{typeInfo?.label} • {format(new Date(input.createdAt), 'MMM dd, yyyy')}</p>
                                      {input.content && (
                                        <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{input.content}</p>
                                      )}
                                      {input.urls && input.urls.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                          {input.urls.map((url, i) => (
                                            <a 
                                              key={i} 
                                              href={url} 
                                              target="_blank" 
                                              rel="noopener noreferrer"
                                              className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
                                            >
                                              <Link className="w-3 h-3" />
                                              Link {i + 1}
                                            </a>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="text-gray-400 hover:text-red-500"
                                    onClick={() => deleteInputMutation.mutate(input.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>
                    ) : !showAddInput && (
                      <div className="p-10 text-center">
                        <div className="w-14 h-14 bg-[#4b7c29]/10 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                          <Lightbulb className="w-7 h-7 text-[#4b7c29]/60" />
                        </div>
                        <p className="font-semibold text-[#3d6622] text-lg">Start shaping your dream event</p>
                        <p className="text-sm text-[#4b7c29]/60 mt-1">Share decor ideas, themes, references or special requests</p>
                        <Button 
                          className="mt-4 bg-[#4b7c29] hover:bg-[#355d1f] hover:-translate-y-0.5 hover:shadow-lg text-white px-6 transition-all duration-200"
                          onClick={() => setShowAddInput(true)}
                        >
                          <Plus className="w-4 h-4 mr-1" /> Add Your First Input
                        </Button>
                        <p className="mt-2 text-xs text-[#4b7c29]/40 italic">You can edit or add more inputs anytime</p>
                        <div className="mt-4 flex flex-wrap justify-center gap-2 text-xs">
                          <span className="px-2.5 py-1 bg-[#4b7c29]/8 border border-[#4b7c29]/15 rounded text-[#4b7c29]/70 hover:bg-[#4b7c29]/12 hover:border-[#4b7c29]/25 transition-colors cursor-default">Stage decor ideas</span>
                          <span className="px-2.5 py-1 bg-[#4b7c29]/8 border border-[#4b7c29]/15 rounded text-[#4b7c29]/70 hover:bg-[#4b7c29]/12 hover:border-[#4b7c29]/25 transition-colors cursor-default">Theme inspirations</span>
                          <span className="px-2.5 py-1 bg-[#4b7c29]/8 border border-[#4b7c29]/15 rounded text-[#4b7c29]/70 hover:bg-[#4b7c29]/12 hover:border-[#4b7c29]/25 transition-colors cursor-default">Pinterest links</span>
                          <span className="px-2.5 py-1 bg-[#4b7c29]/8 border border-[#4b7c29]/15 rounded text-[#4b7c29]/70 hover:bg-[#4b7c29]/12 hover:border-[#4b7c29]/25 transition-colors cursor-default">Outfit references</span>
                          <span className="px-2.5 py-1 bg-[#4b7c29]/8 border border-[#4b7c29]/15 rounded text-[#4b7c29]/70 hover:bg-[#4b7c29]/12 hover:border-[#4b7c29]/25 transition-colors cursor-default">Special requests</span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'timeline' && (
              <div className="space-y-6 animate-fadeIn">
                {/* Countdown and Progress Header */}
                {milestonesData && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Countdown Timer */}
                    {milestonesData.countdown && (
                      <Card className="border-0 shadow-lg bg-gradient-to-br from-[#4b7c29] to-[#3d6621] text-white">
                        <CardContent className="p-6 text-center">
                          <Clock className="w-8 h-8 mx-auto mb-2 opacity-80" />
                          <div className="text-4xl font-bold">{milestonesData.countdown.days}</div>
                          <div className="text-sm opacity-80">Days to Event</div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Overall Progress */}
                    {milestonesData.progress && (
                      <Card className="border-0 shadow-lg">
                        <CardContent className="p-6 text-center">
                          <Target className="w-8 h-8 mx-auto mb-2 text-[#4b7c29]" />
                          <div className="text-4xl font-bold text-[#4b7c29]">{milestonesData.progress.percentage}%</div>
                          <div className="text-sm text-gray-500">Complete</div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                            <div 
                              className="bg-gradient-to-r from-[#4b7c29] to-[#6da035] h-2 rounded-full transition-all duration-1000" 
                              style={{ width: `${milestonesData.progress.percentage}%` }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Tasks Status */}
                    {milestonesData.progress && (
                      <Card className="border-0 shadow-lg">
                        <CardContent className="p-6 text-center">
                          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-500" />
                          <div className="text-4xl font-bold text-gray-800">
                            {milestonesData.progress.completed}/{milestonesData.progress.total}
                          </div>
                          <div className="text-sm text-gray-500">Tasks Done</div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Pending Approvals */}
                    {milestonesData.pendingApprovals > 0 && (
                      <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200">
                        <CardContent className="p-6 text-center">
                          <AlertCircle className="w-8 h-8 mx-auto mb-2 text-amber-500" />
                          <div className="text-4xl font-bold text-amber-600">{milestonesData.pendingApprovals}</div>
                          <div className="text-sm text-amber-700">Action Required</div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Visual Roadmap Timeline */}
                {milestonesData?.phases && milestonesData.phases.length > 0 ? (
                  <div className="space-y-6">
                    {/* Journey Roadmap */}
                    <Card className="border-0 shadow-lg overflow-hidden">
                      <CardContent className="p-6 pb-4">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex flex-col">
                            <h3 className="font-semibold text-[#4b7c29] flex items-center gap-2">
                              <Heart className="w-5 h-5 text-[#4b7c29]" />
                              Your Wedding Journey
                            </h3>
                            <div className="w-24 h-0.5 bg-gradient-to-r from-[#4b7c29] to-transparent mt-1 ml-7"></div>
                          </div>
                          <Badge 
                            variant="outline" 
                            className="border-[#4b7c29] text-[#3d6622] bg-white h-5 text-[11px] font-medium px-2"
                            style={{ borderWidth: '1.5px' }}
                          >
                            {milestonesData.phases.length} Milestones
                          </Badge>
                        </div>
                        
                        {/* Winding Road SVG */}
                        <div className="relative py-4 overflow-x-auto">
                          <svg 
                            viewBox="0 0 1280 280" 
                            className="w-full min-w-[1000px] h-64 roadmap-svg"
                            preserveAspectRatio="xMidYMid meet"
                          >
                            {/* Road Path - Green Theme */}
                            <defs>
                              <linearGradient id="roadGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#2d3a29" />
                                <stop offset="50%" stopColor="#1e2b1a" />
                                <stop offset="100%" stopColor="#2d3a29" />
                              </linearGradient>
                              <linearGradient id="roadCenterLine" x1="0%" y1="0%" x2="100%" y2="0%">
                                <stop offset="0%" stopColor="#6b9b4a" />
                                <stop offset="100%" stopColor="#6b9b4a" />
                              </linearGradient>
                              {/* Fade-out mask for smooth right edge - extended 20% wider gradient with proper stopOpacity */}
                              <linearGradient id="fadeOutMask" x1="0%" y1="0%" x2="120%" y2="0%">
                                <stop offset="0%" stopColor="white" stopOpacity="1" />
                                <stop offset="75%" stopColor="white" stopOpacity="1" />
                                <stop offset="92%" stopColor="white" stopOpacity="0.4" />
                                <stop offset="100%" stopColor="white" stopOpacity="0" />
                              </linearGradient>
                              <mask id="roadFadeMask">
                                <rect x="0" y="0" width="1280" height="280" fill="url(#fadeOutMask)" />
                              </mask>
                              <filter id="roadShadow" x="-10%" y="-10%" width="120%" height="120%">
                                <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.15"/>
                              </filter>
                              {/* Standardized milestone shadow: 0px 3px 6px rgba(0,0,0,0.08) */}
                              <filter id="milestoneShadow" x="-50%" y="-50%" width="200%" height="200%">
                                <feDropShadow dx="0" dy="3" stdDeviation="3" floodOpacity="0.08"/>
                              </filter>
                            </defs>
                            
                            {/* Main Road - Winding Path with fade-out mask */}
                            <g mask="url(#roadFadeMask)">
                              <path
                                d="M -20 150 
                                   C 60 150, 100 80, 180 80
                                   S 300 150, 380 150
                                   S 460 220, 540 220
                                   S 660 150, 740 150
                                   S 820 80, 900 80
                                   S 1020 150, 1050 150
                                   S 1100 220, 1180 220
                                   S 1260 220, 1280 220"
                                fill="none"
                                stroke="url(#roadGradient)"
                                strokeWidth="33"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                filter="url(#roadShadow)"
                                className="road-path"
                              />
                              
                              {/* Road Center Line - Green Dashed */}
                              <path
                                d="M -20 150 
                                   C 60 150, 100 80, 180 80
                                   S 300 150, 380 150
                                   S 460 220, 540 220
                                   S 660 150, 740 150
                                   S 820 80, 900 80
                                   S 1020 150, 1050 150
                                   S 1100 220, 1180 220
                                   S 1260 220, 1280 220"
                                fill="none"
                                stroke="#6b9b4a"
                                strokeWidth="2"
                                strokeDasharray="10,6"
                                strokeLinecap="round"
                                className="road-center-line"
                              />
                            </g>
                            
                            {/* Phase Markers */}
                            {milestonesData.phases.map((phase: any, idx: number) => {
                              const phaseTasks = phase.tasks || [];
                              const completedTasks = phaseTasks.filter((t: any) => t.isCompleted).length;
                              const phaseComplete = phaseTasks.length > 0 && completedTasks === phaseTasks.length;
                              const phaseInProgress = completedTasks > 0 && completedTasks < phaseTasks.length;
                              const isUpcoming = !phaseComplete && !phaseInProgress;
                              const isPhase7 = phase.phaseNumber === 7;
                              const isPhase7Active = isPhase7 && (phaseComplete || phaseInProgress || selectedPhaseId === phase.id);
                              const isActive = phaseInProgress || selectedPhaseId === phase.id;
                              
                              const totalPhases = milestonesData.phases.length;
                              const markerPositions = [
                                { x: 60, y: 150 },
                                { x: 180, y: 80 },
                                { x: 380, y: 150 },
                                { x: 540, y: 220 },
                                { x: 740, y: 150 },
                                { x: 900, y: 80 },
                                { x: 1050, y: 150 },
                                { x: 1180, y: 220 }
                              ];
                              
                              const pos = markerPositions[idx] || { x: 60 + (idx * 140), y: 150 };
                              const x = pos.x;
                              const y = pos.y;
                              const isAboveRoad = y <= 150;
                              
                              // Marker hierarchy colors
                              // Completed: green fill + white check
                              // Active: green fill + glow ring + pulse
                              // Upcoming: white fill + green outline
                              const pinFill = phaseComplete || phaseInProgress 
                                ? '#4b7c29' 
                                : 'white';
                              const pinStroke = phaseComplete || phaseInProgress 
                                ? 'white' 
                                : '#4b7c29';
                              const innerCircleFill = phaseComplete 
                                ? '#4b7c29' 
                                : 'white';
                              const textColor = phaseComplete || phaseInProgress 
                                ? 'white' 
                                : '#4b7c29';
                              
                              // Phase 7 gets 12% larger size (now 24% for more emphasis)
                              const scale = isPhase7 ? 1.24 : 1;
                              const baseRadius = 10;
                              const pinRadius = baseRadius * scale;
                              
                              // Consistent label spacing constants
                              const LABEL_OFFSET_ABOVE = -58;
                              const LABEL_OFFSET_BELOW = 38;
                              const LABEL_HEIGHT = 28;
                              const LABEL_MARGIN = 2;
                              
                              return (
                                <g 
                                  key={phase.id} 
                                  className="cursor-pointer milestone-marker"
                                  onClick={() => setSelectedPhaseId(selectedPhaseId === phase.id ? null : phase.id)}
                                  data-testid={`roadmap-phase-${phase.id}`}
                                  aria-label={isPhase7 ? 'Wedding Day Milestone' : phase.phaseName}
                                  role="button"
                                  tabIndex={0}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      setSelectedPhaseId(selectedPhaseId === phase.id ? null : phase.id);
                                    }
                                  }}
                                  filter="url(#milestoneShadow)"
                                >
                                  {/* Invisible tap target - 44px minimum for accessibility */}
                                  <circle
                                    cx={x}
                                    cy={y - 14 * scale}
                                    r={Math.max(44, 32 * scale)}
                                    fill="transparent"
                                    style={{ pointerEvents: 'all' }}
                                    aria-hidden="true"
                                  />
                                  
                                  {/* Active Phase Glow Ring - thinner ripple */}
                                  {(isActive || isPhase7) && (
                                    <circle
                                      cx={x}
                                      cy={y - 14 * scale}
                                      r={24 * scale}
                                      fill="none"
                                      stroke="#4b7c29"
                                      strokeWidth="1.5"
                                      className={isPhase7 ? "phase7-glow" : "opacity-40"}
                                    />
                                  )}
                                  
                                  {/* Phase 7 Inner Glow */}
                                  {isPhase7 && (
                                    <circle
                                      cx={x}
                                      cy={y - 14 * scale}
                                      r={19 * scale}
                                      fill="rgba(75, 124, 41, 0.06)"
                                      stroke="#4b7c29"
                                      strokeWidth="1"
                                      opacity="0.3"
                                    />
                                  )}
                                  
                                  {/* Pin Shadow */}
                                  <ellipse cx={x} cy={y + 24 * scale} rx={8 * scale} ry={3 * scale} fill="rgba(0,0,0,0.15)" />
                                  
                                  {/* Pin Body - Teardrop Shape */}
                                  <path
                                    d={`M ${x} ${y - 26 * scale} 
                                        C ${x - 14 * scale} ${y - 26 * scale}, ${x - 14 * scale} ${y - 4 * scale}, ${x} ${y + 6 * scale}
                                        C ${x + 14 * scale} ${y - 4 * scale}, ${x + 14 * scale} ${y - 26 * scale}, ${x} ${y - 26 * scale}`}
                                    fill={pinFill}
                                    stroke={pinStroke}
                                    strokeWidth={1.5 * scale}
                                    className="transition-all duration-200"
                                  />
                                  
                                  {/* Pin Circle - centered using cx/cy with consistent radius */}
                                  <circle 
                                    cx={x} 
                                    cy={y - 14 * scale} 
                                    r={pinRadius} 
                                    fill={innerCircleFill}
                                    stroke={phaseComplete ? 'white' : '#4b7c29'}
                                    strokeWidth={isUpcoming ? 1.5 : 0}
                                  />
                                  
                                  {/* Phase Number or Check */}
                                  {phaseComplete ? (
                                    <path
                                      d={`M ${x - 3.5 * scale} ${y - 14 * scale} l ${2.5 * scale} ${2.5 * scale} l ${4.5 * scale} ${-5 * scale}`}
                                      fill="none"
                                      stroke="white"
                                      strokeWidth={2 * scale}
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  ) : (
                                    <text
                                      x={x}
                                      y={y - 10 * scale}
                                      textAnchor="middle"
                                      fill={textColor}
                                      fontSize={10 * scale}
                                      fontWeight="600"
                                    >
                                      {phase.phaseNumber}
                                    </text>
                                  )}
                                  
                                  {/* Phase Name Label - Consistent vertical spacing using constants */}
                                  <foreignObject 
                                    x={x - 55} 
                                    y={isAboveRoad ? y + LABEL_OFFSET_ABOVE : y + LABEL_OFFSET_BELOW} 
                                    width="110" 
                                    height={LABEL_HEIGHT}
                                  >
                                    <div className="text-center" style={{ marginTop: `${LABEL_MARGIN}px` }}>
                                      <p className={`text-[10px] leading-tight transition-colors ${
                                        selectedPhaseId === phase.id ? 'text-[#3d6622] font-semibold' : 'text-[#3d6622]/80 font-medium'
                                      }`} style={{ fontWeight: selectedPhaseId === phase.id ? 600 : 500 }}>
                                        {phase.phaseName}
                                      </p>
                                    </div>
                                  </foreignObject>
                                  
                                  {/* Your Big Day Label - 8px more spacing from road */}
                                  {isPhase7 && (
                                    <foreignObject 
                                      x={x - 70} 
                                      y={y + 48} 
                                      width="140" 
                                      height="36"
                                      className="big-day-label"
                                    >
                                      <div 
                                        className={`flex items-center justify-center gap-2 transition-all duration-300 ${isPhase7Active ? 'scale-110' : 'scale-100'}`}
                                        aria-label="Wedding Day Milestone"
                                        role="status"
                                      >
                                        {/* Heart Icon - SVG Stroke */}
                                        <svg 
                                          width="15" 
                                          height="15" 
                                          viewBox="0 0 24 24" 
                                          fill="none" 
                                          stroke="#4b7c29" 
                                          strokeWidth="2.5" 
                                          strokeLinecap="round" 
                                          strokeLinejoin="round"
                                          className="flex-shrink-0"
                                          aria-hidden="true"
                                        >
                                          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                        </svg>
                                        <span 
                                          className="text-[14px] font-bold whitespace-nowrap tracking-tight text-[#4b7c29]"
                                        >
                                          Your Big Day
                                        </span>
                                      </div>
                                    </foreignObject>
                                  )}
                                </g>
                              );
                            })}
                            
                            {/* Start Marker - matched to milestone visual weight */}
                            <g 
                              transform="translate(0, 130)" 
                              className="start-node-pulse cursor-pointer"
                              role="img"
                              aria-label="Journey Begins - Starting point of your wedding planning"
                            >
                              <title>Journey Begins</title>
                              {/* Outer thin ring - matches milestone glow ring */}
                              <circle cx="20" cy="20" r="26" fill="none" stroke="#4b7c29" strokeWidth="1.5" opacity="0.35" />
                              {/* Pulse ring */}
                              <circle cx="20" cy="20" r="22" fill="#4b7c29" opacity="0.15" className="start-pulse-ring" />
                              {/* Main circle - matches milestone pin size */}
                              <circle cx="20" cy="20" r="14" fill="#4b7c29" opacity="0.95" filter="url(#milestoneShadow)" />
                              {/* Inner white dot */}
                              <circle cx="20" cy="20" r="6" fill="white" />
                            </g>
                          </svg>
                          
                          <div className="flex justify-between items-center text-xs px-4" style={{ marginTop: '-6px' }}>
                            <span className="font-medium text-[#3d6622]/85">Start</span>
                            <span className="text-[#3d6622]/70 italic font-medium">Tap milestone for details</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    
                    {/* Selected Phase Tasks */}
                    {selectedPhaseId && (() => {
                      const selectedPhase = milestonesData.phases.find((p: any) => p.id === selectedPhaseId);
                      if (!selectedPhase) return null;
                      
                      const phaseTasks = selectedPhase.tasks || [];
                      const completedTasks = phaseTasks.filter((t: any) => t.isCompleted).length;
                      const phaseProgress = phaseTasks.length > 0 ? Math.round((completedTasks / phaseTasks.length) * 100) : 0;
                      const phaseComplete = phaseProgress === 100;
                      const phaseInProgress = completedTasks > 0 && !phaseComplete;
                      
                      return (
                        <Card 
                          className={`border-0 shadow-lg overflow-hidden animate-fadeIn ${
                            phaseComplete ? 'ring-2 ring-[#4b7c29]/40' : 
                            phaseInProgress ? 'ring-2 ring-[#4b7c29]/30' : ''
                          }`}
                          data-testid={`selected-phase-tasks-${selectedPhase.id}`}
                        >
                          {/* Phase Header */}
                          <div className={`p-4 ${
                            phaseComplete ? 'bg-gradient-to-r from-[#4b7c29]/10 to-[#4b7c29]/20' :
                            phaseInProgress ? 'bg-gradient-to-r from-[#4b7c29]/5 to-[#4b7c29]/10' :
                            'bg-gradient-to-r from-white to-[#4b7c29]/5'
                          }`}>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                  phaseComplete ? 'bg-[#4b7c29]' :
                                  phaseInProgress ? 'bg-[#4b7c29]' :
                                  'bg-[#4b7c29]/30'
                                }`}>
                                  {phaseComplete ? (
                                    <CheckCircle2 className="w-5 h-5 text-white" />
                                  ) : (
                                    <span className="text-white font-bold">{selectedPhase.phaseNumber}</span>
                                  )}
                                </div>
                                <div>
                                  <h4 className="font-semibold text-[#4b7c29]">{selectedPhase.phaseName}</h4>
                                  <p className="text-xs text-[#4b7c29]/60">
                                    D{selectedPhase.daysBeforeStart >= 0 ? '+' : ''}{selectedPhase.daysBeforeStart} to D{selectedPhase.daysBeforeEnd >= 0 ? '+' : ''}{selectedPhase.daysBeforeEnd}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="text-right">
                                  <div className="text-lg font-bold text-[#4b7c29]">{phaseProgress}%</div>
                                  <div className="text-xs text-[#4b7c29]/60">{completedTasks}/{phaseTasks.length} tasks</div>
                                </div>
                                <Badge className={
                                  phaseComplete ? 'bg-[#4b7c29]/20 text-[#4b7c29]' :
                                  phaseInProgress ? 'bg-[#4b7c29]/10 text-[#4b7c29]' :
                                  'bg-[#4b7c29]/5 text-[#4b7c29]/70'
                                }>
                                  {phaseComplete ? 'Completed' : phaseInProgress ? 'In Progress' : 'Upcoming'}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setSelectedPhaseId(null)}
                                  className="text-[#4b7c29]/50 hover:text-[#4b7c29]"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          
                          {/* Tasks List */}
                          {phaseTasks.length > 0 ? (
                            <div className="p-4 space-y-2">
                              {phaseTasks.map((task: any) => (
                                <div 
                                  key={task.id}
                                  className={`flex items-center gap-3 p-3 rounded-lg ${
                                    task.isCompleted ? 'bg-[#4b7c29]/10 border border-[#4b7c29]/20' :
                                    task.status === 'action_required' ? 'bg-[#4b7c29]/5 border border-[#4b7c29]/30' :
                                    'bg-white border border-[#4b7c29]/10'
                                  }`}
                                  data-testid={`milestone-task-${task.id}`}
                                >
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                    task.isCompleted ? 'bg-[#4b7c29]' : 'bg-[#4b7c29]/20'
                                  }`}>
                                    {task.isCompleted ? (
                                      <CheckCircle2 className="w-4 h-4 text-white" />
                                    ) : (
                                      <div className="w-3 h-3 bg-white rounded-full" />
                                    )}
                                  </div>
                                  <span className={`flex-1 ${task.isCompleted ? 'text-[#4b7c29]/60 line-through' : 'text-[#4b7c29]/90'}`}>
                                    {task.taskName}
                                  </span>
                                  {task.completedAt && (
                                    <span className="text-xs text-[#4b7c29]">
                                      {format(new Date(task.completedAt), 'MMM d')}
                                    </span>
                                  )}
                                  {task.status === 'action_required' && (
                                    <Badge className="bg-[#4b7c29]/20 text-[#4b7c29] text-xs">Action Required</Badge>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-8 text-center text-[#4b7c29]/60">
                              No tasks in this phase yet
                            </div>
                          )}
                        </Card>
                      );
                    })()}
                  </div>
                ) : (
                  <Card className="border-0 shadow-xl overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-blue-400 via-indigo-500 to-blue-400" />
                    <CardContent className="py-16 text-center">
                      <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Target className="w-10 h-10 text-blue-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-gray-700 mb-2">Project Timeline Coming Soon</h3>
                      <p className="text-gray-500 max-w-md mx-auto">
                        Your wedding planner will set up your personalized project timeline with phases and tasks. Check back soon!
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {activeTab === 'feedback' && (
              <div className="space-y-6 animate-fadeIn">
                <Card className="border-0 shadow-xl overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-[#5a8a35] via-[#4b7c29] to-[#5a8a35]" />
                  <CardHeader className="bg-gradient-to-br from-[#4b7c29]/5 to-white">
                    <CardTitle className="flex items-center gap-2">
                      <MessageCircle className="w-5 h-5 text-[#4b7c29]" />
                      Share Your Feedback
                    </CardTitle>
                    <CardDescription>Help us improve by sharing your experience</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <form onSubmit={(e) => { e.preventDefault(); submitFeedbackMutation.mutate(feedback); }} className="space-y-6">
                      <div className="grid gap-6 md:grid-cols-2">
                        <StarRating 
                          value={feedback.overallRating || 0}
                          onChange={(v) => setFeedback({ ...feedback, overallRating: v })}
                          label="Overall Experience"
                        />
                        <StarRating 
                          value={feedback.planningRating || 0}
                          onChange={(v) => setFeedback({ ...feedback, planningRating: v })}
                          label="Planning & Coordination"
                        />
                        <StarRating 
                          value={feedback.executionRating || 0}
                          onChange={(v) => setFeedback({ ...feedback, executionRating: v })}
                          label="Event Execution"
                        />
                        <StarRating 
                          value={feedback.communicationRating || 0}
                          onChange={(v) => setFeedback({ ...feedback, communicationRating: v })}
                          label="Communication"
                        />
                        <StarRating 
                          value={feedback.decorRating || 0}
                          onChange={(v) => setFeedback({ ...feedback, decorRating: v })}
                          label="Decor & Design"
                        />
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="comments" className="text-sm font-medium">What made your event special with Oakstreet?</Label>
                          <Textarea
                            id="comments"
                            placeholder="Share the moments that stood out..."
                            value={feedback.comments || ''}
                            onChange={(e) => setFeedback({ ...feedback, comments: e.target.value })}
                            className="mt-2 min-h-[90px]"
                          />
                        </div>
                        <div>
                          <Label htmlFor="suggestions" className="text-sm font-medium">How can we make your next experience even better?</Label>
                          <Textarea
                            id="suggestions"
                            placeholder="Your suggestions help us grow..."
                            value={feedback.suggestions || ''}
                            onChange={(e) => setFeedback({ ...feedback, suggestions: e.target.value })}
                            className="mt-2 min-h-[90px]"
                          />
                        </div>
                      </div>

                      <Separator />

                      <div className="space-y-4">
                        <div>
                          <Label className="text-sm font-medium">Would you recommend Oakstreet Events to friends and family?</Label>
                          <div className="flex gap-3 mt-2">
                            <Button
                              type="button"
                              variant={feedback.wouldRecommend === true ? 'default' : 'outline'}
                              className={feedback.wouldRecommend === true ? 'bg-[#4b7c29] hover:bg-[#3d6622]' : 'border-[#4b7c29] text-[#4b7c29] hover:bg-[#4b7c29]/10'}
                              onClick={() => setFeedback({ ...feedback, wouldRecommend: true })}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" /> Yes, absolutely!
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              className={feedback.wouldRecommend === false ? 'border-gray-400 bg-gray-100 text-gray-600' : 'border-gray-300 text-gray-500 hover:bg-gray-50'}
                              onClick={() => setFeedback({ ...feedback, wouldRecommend: false })}
                            >
                              Maybe not
                            </Button>
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="testimonial" className="text-sm font-medium">
                            Would you like to share a testimonial? (may be featured on our website)
                          </Label>
                          <Textarea
                            id="testimonial"
                            placeholder="Write a few words about your experience with Oakstreet Events..."
                            value={feedback.testimonial || ''}
                            onChange={(e) => setFeedback({ ...feedback, testimonial: e.target.value })}
                            className="mt-2 min-h-[80px]"
                          />
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full bg-[#4b7c29] hover:bg-[#355d1f] hover:-translate-y-0.5 hover:shadow-lg h-12 text-lg transition-all duration-200"
                        disabled={submitFeedbackMutation.isPending}
                        data-testid="button-submit-feedback"
                      >
                        {submitFeedbackMutation.isPending ? (
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 mr-2" />
                        )}
                        Submit Your Feedback
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}
          </>
        )}
      </main>

      <footer className="border-t bg-white/50 backdrop-blur-sm mt-12">
        <div className="max-w-6xl mx-auto px-4 py-6 text-center">
          <p className="text-xs text-[#4b7c29]/50 tracking-wide">
            © 2026 Oakstreet Events. All rights reserved.
          </p>
          <p className="text-[10px] text-[#4b7c29]/40 mt-1 tracking-wider">Crafted with care for your special moments.</p>
        </div>
      </footer>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.4s ease-out forwards;
        }
        .animate-slideIn {
          animation: slideIn 0.5s ease-out forwards;
          opacity: 0;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* Estimate View Dialog */}
      <Dialog open={!!viewingEstimate} onOpenChange={(open) => { if (!open) { setViewingEstimate(null); setEstimateData(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#4b7c29]" />
              Estimate Details
            </DialogTitle>
          </DialogHeader>
          
          {estimateLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-[#4b7c29]" />
            </div>
          ) : estimateData?.estimate ? (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">{estimateData.estimate.subject || estimateData.estimate.number}</h3>
                    <p className="text-sm text-gray-600">{estimateData.estimate.number}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[#4b7c29]">₹{parseFloat(estimateData.estimate.total || '0').toLocaleString('en-IN')}</p>
                    <Badge className={estimateData.estimate.status === 'approved' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}>
                      {estimateData.estimate.status}
                    </Badge>
                  </div>
                </div>
                {estimateData.estimate.eventDate && (
                  <p className="text-sm text-gray-600"><Calendar className="w-4 h-4 inline mr-1" /> Event Date: {format(new Date(estimateData.estimate.eventDate), 'MMM dd, yyyy')}</p>
                )}
                {estimateData.estimate.eventVenue && (
                  <p className="text-sm text-gray-600"><MapPin className="w-4 h-4 inline mr-1" /> Venue: {estimateData.estimate.eventVenue}</p>
                )}
              </div>

              {/* Line Items */}
              {estimateData.estimate.lineItems && estimateData.estimate.lineItems.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3 text-gray-900">Items</h4>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="text-left p-3 font-medium text-gray-700">Item</th>
                          <th className="text-right p-3 font-medium text-gray-700">Qty</th>
                          <th className="text-right p-3 font-medium text-gray-700">Rate</th>
                          <th className="text-right p-3 font-medium text-gray-700">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {estimateData.estimate.lineItems.map((item: any, idx: number) => (
                          <tr key={idx} className={item.isHeading ? 'bg-gray-100 font-semibold' : 'border-t'}>
                            <td className="p-3">
                              <p className={item.isHeading ? 'text-gray-800' : 'text-gray-900'}>{item.name}</p>
                              {item.description && <p className="text-xs text-gray-500">{item.description}</p>}
                            </td>
                            <td className="p-3 text-right text-gray-600">{item.isHeading ? '-' : item.quantity}</td>
                            <td className="p-3 text-right text-gray-600">{item.isHeading ? '-' : `₹${parseFloat(item.rate || 0).toLocaleString('en-IN')}`}</td>
                            <td className="p-3 text-right font-medium">{item.isHeading ? '-' : `₹${parseFloat(item.total || 0).toLocaleString('en-IN')}`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Totals */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium">₹{parseFloat(estimateData.estimate.subtotal || '0').toLocaleString('en-IN')}</span>
                </div>
                {estimateData.estimate.discount && parseFloat(estimateData.estimate.discount) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount</span>
                    <span>-₹{parseFloat(estimateData.estimate.discount).toLocaleString('en-IN')}</span>
                  </div>
                )}
                {estimateData.estimate.totalTax && parseFloat(estimateData.estimate.totalTax) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax</span>
                    <span className="font-medium">₹{parseFloat(estimateData.estimate.totalTax).toLocaleString('en-IN')}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className="text-[#4b7c29]">₹{parseFloat(estimateData.estimate.total || '0').toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Notes & Terms */}
              {estimateData.estimate.notes && (
                <div>
                  <h4 className="font-semibold mb-2 text-gray-900">Notes</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{estimateData.estimate.notes}</p>
                </div>
              )}
              {estimateData.estimate.terms && (
                <div>
                  <h4 className="font-semibold mb-2 text-gray-900">Terms & Conditions</h4>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{estimateData.estimate.terms}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Could not load estimate details</p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setViewingEstimate(null); setEstimateData(null); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <OaksyPortalChat 
        chatType="portal" 
        portalToken={portalSession?.portalToken}
        clientName={portalSession?.name}
      />
    </div>
  );
}

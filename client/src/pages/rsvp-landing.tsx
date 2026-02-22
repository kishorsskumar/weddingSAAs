import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import whiteLogo from "../assets/atbott-logo.png";
import { 
  Check, 
  Users, 
  MessageSquare, 
  Clock, 
  FileText, 
  Bell,
  ChefHat,
  Star,
  ArrowRight,
  Smartphone,
  Bot,
  Upload,
  Send,
  BarChart3,
  Download,
  Phone,
  X,
  HelpCircle,
  Play
} from "lucide-react";

export default function RsvpLanding() {
  const [demoStep, setDemoStep] = useState(0);
  const [demoAttendance, setDemoAttendance] = useState<string | null>(null);
  const [demoGuestCount, setDemoGuestCount] = useState(2);
  const [demoMeal, setDemoMeal] = useState<string | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [animationPhase, setAnimationPhase] = useState(0);
  const [demoView, setDemoView] = useState<'chat' | 'desk' | 'reminder'>('chat');
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  const resetDemo = () => {
    setDemoStep(0);
    setDemoAttendance(null);
    setDemoGuestCount(2);
    setDemoMeal(null);
    setAnimationPhase(0);
    setDemoView('chat');
  };

  const startAutoPlay = () => {
    setIsAutoPlaying(true);
    resetDemo();
  };

  const stopAutoPlay = () => {
    setIsAutoPlaying(false);
    if (autoPlayRef.current) {
      clearTimeout(autoPlayRef.current);
    }
  };

  useEffect(() => {
    if (!isAutoPlaying) return;

    const runAnimation = () => {
      switch (animationPhase) {
        case 0:
          setDemoView('chat');
          autoPlayRef.current = setTimeout(() => {
            setAnimationPhase(1);
          }, 3000);
          break;
        case 1:
          setDemoAttendance("yes");
          setDemoStep(1);
          autoPlayRef.current = setTimeout(() => {
            setAnimationPhase(2);
          }, 2500);
          break;
        case 2:
          setDemoGuestCount(3);
          setDemoStep(2);
          autoPlayRef.current = setTimeout(() => {
            setAnimationPhase(3);
          }, 2500);
          break;
        case 3:
          setDemoMeal("veg");
          setDemoStep(3);
          autoPlayRef.current = setTimeout(() => {
            setAnimationPhase(4);
          }, 3000);
          break;
        case 4:
          setDemoView('desk');
          autoPlayRef.current = setTimeout(() => {
            setAnimationPhase(5);
          }, 4000);
          break;
        case 5:
          setDemoView('reminder');
          autoPlayRef.current = setTimeout(() => {
            setAnimationPhase(6);
          }, 4000);
          break;
        case 6:
          resetDemo();
          autoPlayRef.current = setTimeout(() => {
            setAnimationPhase(0);
          }, 1000);
          break;
      }
    };

    runAnimation();

    return () => {
      if (autoPlayRef.current) {
        clearTimeout(autoPlayRef.current);
      }
    };
  }, [isAutoPlaying, animationPhase]);

  const handleAttendanceSelect = (status: string) => {
    stopAutoPlay();
    setDemoAttendance(status);
    if (status === "yes") {
      setDemoStep(1);
    } else {
      setDemoStep(3);
    }
  };

  const handleGuestCountSelect = () => {
    stopAutoPlay();
    setDemoStep(2);
  };

  const handleMealSelect = (meal: string) => {
    stopAutoPlay();
    setDemoMeal(meal);
    setDemoStep(3);
  };

  const mockGuests = [
    { name: "Rahul Sharma", status: "confirmed", guests: 3, meal: "Veg", responded: "2 hours ago" },
    { name: "Priya Nair", status: "confirmed", guests: 2, meal: "Non-Veg", responded: "4 hours ago" },
    { name: "Amit Kumar", status: "declined", guests: 0, meal: "-", responded: "1 day ago" },
    { name: "Sneha Menon", status: "pending", guests: 0, meal: "-", responded: "-" },
    { name: "Vikram Singh", status: "confirmed", guests: 4, meal: "Veg", responded: "3 hours ago" },
    { name: "Anjali Gupta", status: "maybe", guests: 2, meal: "-", responded: "5 hours ago" },
  ];

  const features = [
    { icon: MessageSquare, title: "WhatsApp RSVP Automation", desc: "Guests respond directly on WhatsApp - no apps to download" },
    { icon: Users, title: "No Guest Login Required", desc: "Simple click-to-respond experience for all ages" },
    { icon: Bot, title: "AI Powered Follow-ups", desc: "Oaksy AI automatically reminds pending guests" },
    { icon: BarChart3, title: "Live Attendance Tracking", desc: "Real-time dashboard with response analytics" },
    { icon: ChefHat, title: "Meal Planning Automation", desc: "Automatic veg/non-veg counts for caterers" },
    { icon: Star, title: "Fully Managed Service", desc: "We handle everything - you just share the guest list" },
  ];

  const scrollToDemo = () => {
    document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const openWhatsApp = () => {
    window.open('https://wa.me/917902373354?text=Hi, I am interested in the RSVP service for my event.', '_blank');
  };

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Hero Section - Using Oak primary color */}
      <section className="bg-primary text-white py-10 sm:py-16 lg:py-24 relative">
        <div className="absolute top-6 left-6 sm:top-8 sm:left-8">
          <img src={whiteLogo} alt="Company Logo" className="h-16 sm:h-20 w-auto" />
        </div>
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="bg-white/20 text-white border-0 mb-6 text-sm px-4 py-1" data-testid="badge-oakstreet">
              Powered by KnotVite
            </Badge>
            
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight" data-testid="text-hero-title">
              Smart WhatsApp RSVP System
              
            </h1>
            
            <p className="text-lg sm:text-xl text-white/90 mb-10 max-w-2xl mx-auto leading-relaxed" data-testid="text-hero-subtitle">
              Automate guest confirmations, reminders and attendance tracking without apps or logins.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button 
                size="lg" 
                className="bg-white text-primary hover:bg-white/90 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 w-full sm:w-auto"
                onClick={scrollToDemo}
                data-testid="button-view-demo"
              >
                <Smartphone className="h-5 w-5 mr-2" />
                View Guest Demo
              </Button>
              <Button 
                size="lg" 
                variant="outline" 
                className="border-white bg-white text-primary hover:bg-white/90 text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 w-full sm:w-auto"
                onClick={openWhatsApp}
                data-testid="button-activate-service"
              >
                Activate RSVP Service
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </div>
            <div className="mt-8">
              <Button 
                size="lg"
                variant="ghost"
                className="text-white border-2 border-white/50 hover:bg-white/20 hover:border-white text-base px-6 py-5"
                onClick={() => window.open('/rsvp-flow-pdf', '_blank')}
                data-testid="button-download-pdf"
              >
                <Download className="h-5 w-5 mr-2" />
                Download Customer Flow PDF
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section id="demo-section" className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4" data-testid="text-demo-title">
                Watch the Guest Journey
              </h2>
              <p className="text-gray-600">
                See how easy it is for your guests to respond via WhatsApp
              </p>
              <div className="flex items-center justify-center gap-1 mt-3">
                {[0, 1, 2, 3, 4, 5].map((step) => (
                  <div 
                    key={step}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      animationPhase > step ? 'w-6 bg-primary' : 'w-2 bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            <Card className="overflow-hidden shadow-2xl max-w-md mx-auto" data-testid="card-demo-whatsapp">
              <CardHeader className="bg-primary text-white p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold">Oaksy</p>
                    <p className="text-xs text-green-200">AI Assistant</p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                {/* Chat View */}
                {demoView === 'chat' && (
                  <div className="bg-[#e5ddd5] p-4 space-y-3 min-h-[280px] animate-in fade-in duration-300">
                    {/* Step 0: Initial invite */}
                    {demoStep === 0 && (
                      <>
                        <div className="flex justify-start animate-in fade-in duration-300">
                          <div className="bg-white rounded-lg rounded-tl-none p-3 max-w-[85%] shadow-sm">
                            <p className="text-sm text-gray-800">
                              Hi Rahul! 👋<br /><br />
                              You're invited to <strong>Anjali's Wedding</strong> on <strong>Feb 10, 2026</strong>.<br /><br />
                              Will you be attending?
                            </p>
                          </div>
                        </div>
                        {!isAutoPlaying && (
                          <div className="flex flex-col gap-2 mt-4">
                            <Button className="bg-primary w-full justify-start" onClick={() => handleAttendanceSelect("yes")}><Check className="h-4 w-4 mr-2" />Attending</Button>
                            <Button variant="outline" className="w-full justify-start border-red-300 text-red-600" onClick={() => handleAttendanceSelect("no")}><X className="h-4 w-4 mr-2" />Not Attending</Button>
                          </div>
                        )}
                      </>
                    )}

                    {/* Step 1: Guest selects Attending */}
                    {demoStep === 1 && (
                      <>
                        <div className="flex justify-end animate-in slide-in-from-right-2 duration-300">
                          <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none p-3 shadow-sm">
                            <p className="text-sm text-gray-800">✅ Attending</p>
                          </div>
                        </div>
                        <div className="flex justify-start animate-in fade-in slide-in-from-left-2 duration-300">
                          <div className="bg-white rounded-lg rounded-tl-none p-3 max-w-[85%] shadow-sm">
                            <p className="text-sm text-gray-800">Wonderful! 🎉 How many guests?</p>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Step 2: Guest count + meal preference */}
                    {demoStep === 2 && (
                      <>
                        <div className="flex justify-end animate-in slide-in-from-right-2 duration-300">
                          <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none p-3 shadow-sm">
                            <p className="text-sm text-gray-800">{demoGuestCount} guests</p>
                          </div>
                        </div>
                        <div className="flex justify-start animate-in fade-in slide-in-from-left-2 duration-300">
                          <div className="bg-white rounded-lg rounded-tl-none p-3 max-w-[85%] shadow-sm">
                            <p className="text-sm text-gray-800">Great! What's your meal preference?</p>
                          </div>
                        </div>
                      </>
                    )}

                    {/* Step 3: Confirmation */}
                    {demoStep === 3 && (
                      <>
                        <div className="flex justify-end animate-in slide-in-from-right-2 duration-300">
                          <div className="bg-[#dcf8c6] rounded-lg rounded-tr-none p-3 shadow-sm">
                            <p className="text-sm text-gray-800">🥗 Vegetarian</p>
                          </div>
                        </div>
                        <div className="flex justify-start animate-in fade-in slide-in-from-left-2 duration-500">
                          <div className="bg-white rounded-lg rounded-tl-none p-3 max-w-[85%] shadow-sm">
                            <p className="text-sm text-gray-800">
                              ✅ <strong>RSVP Confirmed!</strong><br /><br />
                              Party of {demoGuestCount} • Vegetarian<br /><br />
                              See you at the wedding! 💍
                            </p>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Desk View - Dashboard Processing */}
                {demoView === 'desk' && (
                  <div className="bg-white p-4 min-h-[280px] animate-in fade-in duration-500">
                    <div className="text-center mb-3">
                      <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-xs font-medium">
                        <BarChart3 className="h-3 w-3" />
                        Live Dashboard Update
                      </div>
                    </div>
                    <div className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 border-b">
                        <p className="text-xs font-medium text-gray-600">Anjali's Wedding - Guest Responses</p>
                      </div>
                      <div className="divide-y">
                        <div className="flex items-center justify-between px-3 py-2 bg-green-50 animate-in slide-in-from-right-4 duration-500">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-primary/20 rounded-full flex items-center justify-center">
                              <Check className="h-3 w-3 text-primary" />
                            </div>
                            <span className="text-sm font-medium">Rahul Sharma</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-gray-600">3 guests</span>
                            <span className="text-green-600">Veg</span>
                            <Badge className="bg-green-100 text-green-700 text-[10px]">Confirmed</Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 text-gray-400">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                              <Clock className="h-3 w-3" />
                            </div>
                            <span className="text-sm">Priya Nair</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">Pending</Badge>
                        </div>
                        <div className="flex items-center justify-between px-3 py-2 text-gray-400">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center">
                              <Clock className="h-3 w-3" />
                            </div>
                            <span className="text-sm">Amit Kumar</span>
                          </div>
                          <Badge variant="outline" className="text-[10px]">Pending</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="bg-green-50 rounded p-2">
                        <p className="text-lg font-bold text-green-600">1</p>
                        <p className="text-[10px] text-gray-500">Confirmed</p>
                      </div>
                      <div className="bg-yellow-50 rounded p-2">
                        <p className="text-lg font-bold text-yellow-600">2</p>
                        <p className="text-[10px] text-gray-500">Pending</p>
                      </div>
                      <div className="bg-blue-50 rounded p-2">
                        <p className="text-lg font-bold text-blue-600">3</p>
                        <p className="text-[10px] text-gray-500">Total Guests</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Reminder View */}
                {demoView === 'reminder' && (
                  <div className="bg-[#e5ddd5] p-4 min-h-[280px] animate-in fade-in duration-500">
                    <div className="text-center mb-3">
                      <div className="inline-flex items-center gap-2 bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-medium">
                        <Bell className="h-3 w-3" />
                        Auto Reminder Sent
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-start animate-in fade-in slide-in-from-left-2 duration-300">
                        <div className="bg-white rounded-lg rounded-tl-none p-3 max-w-[85%] shadow-sm">
                          <p className="text-sm text-gray-800">
                            Hi Priya! 👋<br /><br />
                            Friendly reminder about <strong>Anjali's Wedding</strong> on Feb 10!<br /><br />
                            We noticed you haven't responded yet. Will you be attending?
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-start">
                        <div className="flex flex-col gap-1.5">
                          <div className="bg-primary text-white text-sm px-4 py-2 rounded-lg flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '200ms' }}>
                            <Check className="h-4 w-4" /> Yes, I'll attend
                          </div>
                          <div className="bg-white text-red-500 text-sm px-4 py-2 rounded-lg border border-red-200 flex items-center gap-2 animate-in slide-in-from-bottom-2 duration-300" style={{ animationDelay: '300ms' }}>
                            <X className="h-4 w-4" /> Can't make it
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 text-center">
                      <p className="text-xs text-gray-500">Oaksy automatically follows up with pending guests</p>
                    </div>
                  </div>
                )}

              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4" data-testid="text-how-title">
                How It Works
              </h2>
              <p className="text-gray-600">Simple 5-step process for stress-free guest management</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 sm:gap-6">
              {[
                { step: 1, icon: Upload, title: "Share Guest List", desc: "Upload your guest names and phone numbers" },
                { step: 2, icon: Send, title: "Oaksy Sends Invites", desc: "WhatsApp invites sent to all guests" },
                { step: 3, icon: MessageSquare, title: "Guests Respond", desc: "One-tap response on WhatsApp" },
                { step: 4, icon: BarChart3, title: "Track Responses", desc: "Live dashboard with all RSVPs" },
                { step: 5, icon: FileText, title: "Get Final Report", desc: "Detailed report for venue and caterer" },
              ].map((item, index) => (
                <div key={index} className="text-center relative" data-testid={`step-${item.step}`}>
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                    <item.icon className="h-7 w-7 text-primary" />
                  </div>
                  <div className="absolute top-8 left-[60%] right-0 h-0.5 bg-green-200 hidden md:block last:hidden" style={{ display: index === 4 ? 'none' : undefined }} />
                  <p className="text-xs text-primary font-semibold mb-1">STEP {item.step}</p>
                  <h3 className="font-semibold text-sm mb-1">{item.title}</h3>
                  <p className="text-xs text-gray-500">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4" data-testid="text-dashboard-title">
                Operator Dashboard Preview
              </h2>
              <p className="text-gray-600">Real-time tracking and reporting for event managers</p>
            </div>

            <Card className="overflow-hidden shadow-xl" data-testid="card-dashboard-preview">
              <CardHeader className="bg-gray-900 text-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                  </div>
                  <span className="text-sm text-gray-400">Oak RSVP Dashboard</span>
                  <Badge variant="outline" className="text-green-400 border-green-400">DEMO DATA</Badge>
                </div>
              </CardHeader>
              
              <CardContent className="p-6 bg-white">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gray-50 rounded-lg p-4 text-center" data-testid="stat-total-invited">
                    <p className="text-3xl font-bold text-gray-900" data-testid="text-stat-invited">156</p>
                    <p className="text-sm text-gray-500">Total Invited</p>
                  </div>
                  <div className="bg-green-50 rounded-lg p-4 text-center" data-testid="stat-confirmed">
                    <p className="text-3xl font-bold text-primary" data-testid="text-stat-confirmed">98</p>
                    <p className="text-sm text-primary">Confirmed</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-4 text-center" data-testid="stat-declined">
                    <p className="text-3xl font-bold text-red-600" data-testid="text-stat-declined">23</p>
                    <p className="text-sm text-red-600">Declined</p>
                  </div>
                  <div className="bg-yellow-50 rounded-lg p-4 text-center" data-testid="stat-pending">
                    <p className="text-3xl font-bold text-yellow-600" data-testid="text-stat-pending">35</p>
                    <p className="text-sm text-yellow-600">Pending</p>
                  </div>
                </div>

                {/* Meal Stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="flex items-center gap-3 p-3 border rounded-lg" data-testid="stat-veg-meals">
                    <span className="w-4 h-4 rounded-full bg-green-500" />
                    <div>
                      <p className="text-lg font-semibold" data-testid="text-stat-veg">127</p>
                      <p className="text-xs text-gray-500">Vegetarian Meals</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 border rounded-lg" data-testid="stat-nonveg-meals">
                    <span className="w-4 h-4 rounded-full bg-red-500" />
                    <div>
                      <p className="text-lg font-semibold" data-testid="text-stat-nonveg">89</p>
                      <p className="text-xs text-gray-500">Non-Veg Meals</p>
                    </div>
                  </div>
                </div>

                {/* Guest List Preview */}
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 flex justify-between items-center">
                    <span className="text-sm font-medium">Recent Responses</span>
                    <Button size="sm" variant="outline" className="h-7 text-xs" data-testid="button-export-demo">
                      <Download className="h-3 w-3 mr-1" />
                      Export
                    </Button>
                  </div>
                  <div className="divide-y">
                    {mockGuests.map((guest, idx) => (
                      <div key={idx} className="px-4 py-3 flex items-center justify-between text-sm" data-testid={`guest-row-${idx}`}>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium">
                            {guest.name.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span className="font-medium">{guest.name}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge 
                            variant="outline" 
                            className={
                              guest.status === "confirmed" ? "text-primary border-green-300 bg-green-50" :
                              guest.status === "declined" ? "text-red-600 border-red-300 bg-red-50" :
                              guest.status === "maybe" ? "text-yellow-600 border-yellow-300 bg-yellow-50" :
                              "text-gray-500 border-gray-300"
                            }
                          >
                            {guest.status}
                          </Badge>
                          <span className="text-gray-500 hidden sm:inline">{guest.guests > 0 ? `${guest.guests} guests` : '-'}</span>
                          <span className="text-gray-400 hidden md:inline">{guest.responded}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-4" data-testid="text-features-title">
                Why Choose Oak RSVP?
              </h2>
              <p className="text-gray-600">Everything you need for hassle-free guest management</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature, idx) => (
                <Card key={idx} className="border-0 shadow-md hover:shadow-lg transition-shadow" data-testid={`feature-card-${idx}`}>
                  <CardContent className="p-6">
                    <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                      <feature.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-sm text-gray-600">{feature.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-primary to-primary text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4" data-testid="text-cta-title">
            Ready to Simplify Your Guest Management?
          </h2>
          <p className="text-green-100 mb-8 max-w-xl mx-auto">
            Get started today. Share your guest list and let our AI handle the rest.
          </p>
          <Button 
            size="lg" 
            className="bg-white text-primary hover:bg-green-50 text-base sm:text-lg px-6 sm:px-10 py-5 sm:py-6 w-full sm:w-auto"
            onClick={openWhatsApp}
            data-testid="button-book-service"
          >
            <Phone className="h-5 w-5 mr-2" />
            Book RSVP Service For Your Event
          </Button>
          <p className="text-green-200 text-sm mt-4">
            Chat with us on WhatsApp to get started
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-8">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm">
            KnotVite RSVP Service
          </p>
        </div>
      </footer>
    </div>
  );
}

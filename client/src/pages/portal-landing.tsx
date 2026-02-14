import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Users, MapPin, Phone, Mail, Instagram, Facebook, Youtube, CheckCircle2, Sparkles, Heart, PartyPopper, Building2, Cake, Star, ArrowRight, Loader2, Camera, Music, Utensils, Car, Shirt, FileText, ClipboardList, Shield, Play, Gift, Crown, Plus, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface CompanySettings {
  companyName?: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: string;
  socialLinks?: {
    instagram?: string;
    facebook?: string;
    youtube?: string;
    pinterest?: string;
  };
}

// Convert Google Drive URLs to direct image URLs using lh3.googleusercontent.com CDN
function convertToDirectImageUrl(url: string): string {
  if (!url) return url;
  
  let fileId: string | null = null;
  
  const driveFileMatch = url.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch) fileId = driveFileMatch[1];
  
  const driveOpenMatch = url.match(/drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/);
  if (driveOpenMatch) fileId = driveOpenMatch[1];
  
  const driveUcMatch = url.match(/drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/);
  if (driveUcMatch) fileId = driveUcMatch[1];
  
  const driveThumbnailMatch = url.match(/drive\.google\.com\/thumbnail\?id=([a-zA-Z0-9_-]+)/);
  if (driveThumbnailMatch) fileId = driveThumbnailMatch[1];
  
  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
  }
  
  return url;
}

const SERVICES = [
  { id: "wedding_planning", label: "End-to-End Wedding Planning & Coordination", icon: Crown },
  { id: "venue_selection", label: "Venue Selection & Management", icon: MapPin },
  { id: "theme_design", label: "Theme Design & Creative Concept Development", icon: Sparkles },
  { id: "decor_floral", label: "Luxury Decor & Floral Styling", icon: Heart },
  { id: "lighting", label: "Lighting Design & Technical Production", icon: Star },
  { id: "sound_music", label: "Sound, Music & Entertainment Management", icon: Music },
  { id: "photo_video", label: "Photography, Videography & Content Creation", icon: Camera },
  { id: "catering", label: "Catering Management & Culinary Experience Planning", icon: Utensils },
  { id: "guest_rsvp", label: "Guest Hospitality & RSVP Management", icon: Users },
  { id: "accommodation", label: "Accommodation & Transportation Coordination", icon: Car },
  { id: "styling", label: "Bridal & Groom Styling Services", icon: Shirt },
  { id: "invitations", label: "Invitation Design & Wedding Stationery", icon: FileText },
  { id: "logistics", label: "On-Ground Logistics & Vendor Management", icon: ClipboardList },
  { id: "legal", label: "Legal Permissions & Compliance Handling", icon: Shield },
  { id: "rehearsal", label: "Rehearsal Planning & Wedding Day Execution", icon: Play },
  { id: "post_wedding", label: "Post-Wedding Services & Deliverables Management", icon: Gift },
  { id: "luxury_addons", label: "Luxury Add-ons & Bespoke Wedding Experiences", icon: PartyPopper },
];

const EVENT_TYPES = [
  { value: "hindu_wedding", label: "Hindu Wedding" },
  { value: "christian_wedding", label: "Christian Wedding" },
  { value: "muslim_wedding", label: "Muslim Wedding" },
  { value: "engagement", label: "Engagement" },
  { value: "reception", label: "Reception" },
  { value: "sangeet", label: "Sangeet/Mehendi" },
  { value: "haldi", label: "Haldi" },
  { value: "corporate", label: "Corporate Event" },
  { value: "birthday", label: "Birthday Party" },
  { value: "house_warming", label: "House Warming" },
  { value: "other", label: "Other" },
];

const BUDGET_RANGES = [
  { value: "under_2L", label: "Under ₹2 Lakhs" },
  { value: "2L_5L", label: "₹2 - 5 Lakhs" },
  { value: "5L_10L", label: "₹5 - 10 Lakhs" },
  { value: "10L_20L", label: "₹10 - 20 Lakhs" },
  { value: "20L_50L", label: "₹20 - 50 Lakhs" },
  { value: "above_50L", label: "Above ₹50 Lakhs" },
];

interface PortfolioAlbum {
  id: string;
  title: string;
  tagline: string | null;
  venue: string | null;
  coverImageUrl: string;
  category: string;
}

export default function PortalLanding() {
  const { toast } = useToast();
  const [step, setStep] = useState<"landing" | "form" | "otp" | "success">("landing");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [leadId, setLeadId] = useState<string>("");

  const [portfolioAlbums, setPortfolioAlbums] = useState<PortfolioAlbum[]>([]);

  const { data: companySettings } = useQuery<CompanySettings>({
    queryKey: ["/api/company-settings"],
  });

  const companyName = companySettings?.companyName || 'Your Event Planner';
  const companyEmail = companySettings?.email || '';
  const companyPhone = companySettings?.phone || '';
  const companyWebsite = companySettings?.website || '';
  const socialLinks = companySettings?.socialLinks || {} as any;

  useEffect(() => {
    console.log('[PortalLanding] Fetching portfolio albums...');
    fetch('/api/portfolio/albums/featured')
      .then(res => {
        console.log('[PortalLanding] Response status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('[PortalLanding] Received data:', data);
        if (Array.isArray(data)) {
          console.log('[PortalLanding] Setting albums:', data.length);
          setPortfolioAlbums(data);
        }
      })
      .catch(err => console.error('[PortalLanding] Failed to fetch portfolio:', err));
  }, []);

  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    whatsappNumber: "",
    address: "",
    city: "",
    budgetRange: "",
    additionalNotes: "",
  });

  const [events, setEvents] = useState([
    { id: 1, eventType: "", customEventType: "", eventDate: "", venue: "", venueCity: "", guestCount: "" }
  ]);

  const addEvent = () => {
    setEvents([...events, { id: Date.now(), eventType: "", customEventType: "", eventDate: "", venue: "", venueCity: "", guestCount: "" }]);
  };

  const removeEvent = (id: number) => {
    if (events.length > 1) {
      setEvents(events.filter(e => e.id !== id));
    }
  };

  const updateEvent = (id: number, field: string, value: string) => {
    setEvents(events.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  const submitLeadMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/portal/leads", data);
      return res.json();
    },
    onSuccess: (data) => {
      setLeadId(data.id);
      setStep("otp");
      toast({ title: "OTP Sent!", description: "Please check your WhatsApp for the verification code." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to submit. Please try again.", variant: "destructive" });
    },
  });

  const verifyOtpMutation = useMutation({
    mutationFn: async (data: { leadId: string; otp: string }) => {
      const res = await apiRequest("POST", "/api/portal/verify-otp", data);
      return res.json();
    },
    onSuccess: () => {
      setStep("success");
      toast({ title: "Verified!", description: "Your enquiry has been submitted successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Invalid OTP", description: error.message || "Please enter the correct OTP.", variant: "destructive" });
    },
  });

  const resendOtpMutation = useMutation({
    mutationFn: async (leadId: string) => {
      const res = await apiRequest("POST", "/api/portal/resend-otp", { leadId });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "OTP Resent!", description: "Please check your WhatsApp." });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast({ title: "Terms Required", description: "Please accept the terms and conditions.", variant: "destructive" });
      return;
    }
    if (selectedServices.length === 0) {
      toast({ title: "Services Required", description: "Please select at least one service.", variant: "destructive" });
      return;
    }
    // Format events for submission
    const formattedEvents = events.map(e => ({
      eventType: e.eventType === 'other' ? e.customEventType : e.eventType,
      eventDate: e.eventDate || null,
      venue: e.venue || null,
      venueCity: e.venueCity || null,
      guestCount: e.guestCount ? parseInt(e.guestCount) : null,
    }));

    submitLeadMutation.mutate({
      ...formData,
      events: formattedEvents,
      eventType: formattedEvents[0]?.eventType || null,
      eventDate: formattedEvents[0]?.eventDate || null,
      venue: formattedEvents[0]?.venue || null,
      venueCity: formattedEvents[0]?.venueCity || null,
      guestCount: formattedEvents[0]?.guestCount || null,
      servicesRequired: selectedServices,
      termsAccepted,
    });
  };

  const handleVerifyOtp = () => {
    if (otpValue.length !== 6) {
      toast({ title: "Invalid OTP", description: "Please enter the 6-digit OTP.", variant: "destructive" });
      return;
    }
    verifyOtpMutation.mutate({ leadId, otp: otpValue });
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices(prev => 
      prev.includes(serviceId) ? prev.filter(s => s !== serviceId) : [...prev, serviceId]
    );
  };

  if (step === "success") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center border-[#4b7c29]/20">
          <CardContent className="pt-8 pb-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h2>
            <p className="text-gray-600 mb-6">
              Your enquiry has been submitted successfully. Our wedding planner will contact you within 24 hours.
            </p>
            <div className="bg-gray-50 rounded-lg p-4 text-left">
              <p className="text-sm text-gray-500 mb-2">What happens next?</p>
              <ul className="text-sm text-gray-700 space-y-2">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">1.</span>
                  <span>A dedicated wedding planner will be assigned to you</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">2.</span>
                  <span>You'll receive their contact details via WhatsApp</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 mt-0.5">3.</span>
                  <span>They'll schedule a consultation to understand your vision</span>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "otp") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-[#4b7c29]/20">
          <CardHeader className="text-center">
            <CardTitle className="text-[#4b7c29]">Verify Your WhatsApp</CardTitle>
            <CardDescription>
              We've sent a 6-digit OTP to your WhatsApp number ending in ...{formData.whatsappNumber.slice(-4)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="otp">Enter OTP</Label>
              <Input
                id="otp"
                value={otpValue}
                onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                className="text-center text-2xl tracking-widest"
                maxLength={6}
                data-testid="input-otp"
              />
            </div>
            <Button 
              onClick={handleVerifyOtp} 
              className="w-full bg-[#4b7c29] hover:bg-[#3d6621]"
              disabled={verifyOtpMutation.isPending}
              data-testid="button-verify-otp"
            >
              {verifyOtpMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Verify & Submit
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => resendOtpMutation.mutate(leadId)}
                disabled={resendOtpMutation.isPending}
                className="text-sm text-[#4b7c29] hover:underline"
              >
                {resendOtpMutation.isPending ? "Sending..." : "Resend OTP"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === "form") {
    return (
      <div className="min-h-screen bg-white">
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/oakstreet-logo.jpg" alt={companyName} className="h-10 w-auto" />
            </div>
            <Button variant="ghost" onClick={() => setStep("landing")}>← Back</Button>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Tell Us About Your Event</h1>
            <p className="text-gray-600">Fill in the details below and we'll get back to you within 24 hours</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Details</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required data-testid="input-name" />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required data-testid="input-email" />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input id="phone" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="+91 9876543210" required data-testid="input-phone" />
                </div>
                <div>
                  <Label htmlFor="whatsapp">WhatsApp Number *</Label>
                  <Input id="whatsapp" value={formData.whatsappNumber} onChange={(e) => setFormData({...formData, whatsappNumber: e.target.value})} placeholder="+91 9876543210" required data-testid="input-whatsapp" />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" value={formData.address} onChange={(e) => setFormData({...formData, address: e.target.value})} data-testid="input-address" />
                </div>
                <div>
                  <Label htmlFor="city">City</Label>
                  <Input id="city" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})} data-testid="input-city" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg">Event Details</CardTitle>
                <Button type="button" variant="outline" size="sm" onClick={addEvent} className="text-[#4b7c29] border-[#4b7c29] hover:bg-green-50">
                  <Plus className="w-4 h-4 mr-1" /> Add Event
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {events.map((event, index) => (
                  <div key={event.id} className={`${index > 0 ? 'pt-6 border-t' : ''}`}>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-[#4b7c29]">Event {index + 1}</span>
                      {events.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeEvent(event.id)} className="text-red-500 hover:text-red-600 hover:bg-red-50 h-8 px-2">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Event Type *</Label>
                        <Select value={event.eventType} onValueChange={(value) => updateEvent(event.id, 'eventType', value)}>
                          <SelectTrigger data-testid={`select-event-type-${index}`}>
                            <SelectValue placeholder="Select event type" />
                          </SelectTrigger>
                          <SelectContent>
                            {EVENT_TYPES.map(type => (
                              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {event.eventType === 'other' && (
                          <Input 
                            className="mt-2" 
                            placeholder="Please specify event type" 
                            value={event.customEventType} 
                            onChange={(e) => updateEvent(event.id, 'customEventType', e.target.value)}
                            data-testid={`input-custom-event-type-${index}`}
                          />
                        )}
                      </div>
                      <div>
                        <Label>Event Date</Label>
                        <Input type="date" value={event.eventDate} onChange={(e) => updateEvent(event.id, 'eventDate', e.target.value)} data-testid={`input-event-date-${index}`} />
                      </div>
                      <div>
                        <Label>Venue Name</Label>
                        <Input value={event.venue} onChange={(e) => updateEvent(event.id, 'venue', e.target.value)} placeholder="e.g., Taj Vivanta" data-testid={`input-venue-${index}`} />
                      </div>
                      <div>
                        <Label>Venue City</Label>
                        <Input value={event.venueCity} onChange={(e) => updateEvent(event.id, 'venueCity', e.target.value)} placeholder="e.g., Kochi" data-testid={`input-venue-city-${index}`} />
                      </div>
                      <div>
                        <Label>Expected Guest Count</Label>
                        <Input type="number" value={event.guestCount} onChange={(e) => updateEvent(event.id, 'guestCount', e.target.value)} placeholder="e.g., 500" data-testid={`input-guest-count-${index}`} />
                      </div>
                    </div>
                  </div>
                ))}
                
                <div className="pt-4 border-t">
                  <Label htmlFor="budget">Overall Budget Range</Label>
                  <Select value={formData.budgetRange} onValueChange={(value) => setFormData({...formData, budgetRange: value})}>
                    <SelectTrigger data-testid="select-budget">
                      <SelectValue placeholder="Select budget range" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUDGET_RANGES.map(range => (
                        <SelectItem key={range.value} value={range.value}>{range.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Services Required *</CardTitle>
                <CardDescription>Select all the services you're interested in</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {SERVICES.map(service => {
                    const Icon = service.icon;
                    const isSelected = selectedServices.includes(service.id);
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => toggleService(service.id)}
                        className={`p-3 rounded-lg border-2 transition-all text-left flex items-center gap-3 ${
                          isSelected 
                            ? 'border-[#4b7c29] bg-green-50 text-[#4b7c29]' 
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        data-testid={`service-${service.id}`}
                      >
                        <Icon className={`w-5 h-5 flex-shrink-0 ${isSelected ? 'text-[#4b7c29]' : 'text-gray-400'}`} />
                        <span className="text-sm font-medium">{service.label}</span>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Information</CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="notes">Tell us more about your vision</Label>
                <Textarea 
                  id="notes" 
                  value={formData.additionalNotes} 
                  onChange={(e) => setFormData({...formData, additionalNotes: e.target.value})}
                  placeholder="Describe your dream event, any specific themes, colors, or references you have in mind..."
                  rows={4}
                  data-testid="input-notes"
                />
              </CardContent>
            </Card>

            <div className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
              <Checkbox 
                id="terms" 
                checked={termsAccepted} 
                onCheckedChange={(checked) => setTermsAccepted(checked as boolean)}
                data-testid="checkbox-terms"
              />
              <div>
                <label htmlFor="terms" className="text-sm font-medium cursor-pointer">
                  I accept the Terms & Conditions
                </label>
                <p className="text-xs text-gray-500 mt-1">
                  By submitting this form, you agree to receive communications from us via WhatsApp and email.
                </p>
              </div>
            </div>

            <Button 
              type="submit" 
              size="lg" 
              className="w-full bg-[#4b7c29] hover:bg-[#3d6621] text-lg py-6"
              disabled={submitLeadMutation.isPending}
              data-testid="button-submit"
            >
              {submitLeadMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : null}
              Submit Enquiry
            </Button>
          </form>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/oakstreet-logo.jpg" alt={companyName} className="h-10 w-auto" />
          </div>
          <div className="flex items-center gap-4">
            {socialLinks?.instagram && (
              <a href={socialLinks.instagram} target="_blank" rel="noopener" className="text-gray-500 hover:text-pink-600">
                <Instagram className="w-5 h-5" />
              </a>
            )}
            {socialLinks?.facebook && (
              <a href={socialLinks.facebook} target="_blank" rel="noopener" className="text-gray-500 hover:text-blue-600">
                <Facebook className="w-5 h-5" />
              </a>
            )}
            {socialLinks?.youtube && (
              <a href={socialLinks.youtube} target="_blank" rel="noopener" className="text-gray-500 hover:text-red-600">
                <Youtube className="w-5 h-5" />
              </a>
            )}
          </div>
        </div>
      </header>

      <section className="relative py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
            Transform Your Special Day Into <span className="text-[#4b7c29]">Unforgettable Memories</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Kerala's premier event decorators. From intimate engagements to grand weddings, we bring your vision to life with elegance and creativity.
          </p>
          <Button 
            size="lg" 
            onClick={() => setStep("form")}
            className="bg-[#4b7c29] hover:bg-[#3d6621] text-lg px-8 py-6"
            data-testid="button-get-started"
          >
            Get Started <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <p className="mt-6 text-gray-600">
            Already a customer?{" "}
            <Link href="/my-portal" className="text-[#4b7c29] font-semibold hover:underline">
              Login to your portal
            </Link>
          </p>
        </div>
      </section>

      {/* Welcome Section */}
      <section className="py-20 px-4 bg-white overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <span className="text-4xl mb-4 block">🌸</span>
            <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Welcome to <span className="text-[#4b7c29]">{companyName}</span>
            </h3>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              We're delighted to have you here — where every celebration becomes a timeless story. ✨
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 border border-green-100 mb-12">
            <p className="text-lg text-gray-700 leading-relaxed text-center mb-8">
              We specialize in <strong className="text-[#4b7c29]">luxury weddings, destination celebrations, and bespoke event experiences</strong> that truly reflect your vision and personality. 💍🌿
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
              {socialLinks?.instagram && (
                <a 
                  href={socialLinks.instagram}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center p-4 rounded-xl bg-gradient-to-br from-pink-50 to-green-50 hover:from-pink-100 hover:to-green-100 transition-all duration-300 hover:scale-105 hover:shadow-md"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-500 to-green-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Instagram className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Instagram</span>
                </a>
              )}
              
              <a 
                href="/portfolio" 
                className="group flex flex-col items-center p-4 rounded-xl bg-gradient-to-br from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 transition-all duration-300 hover:scale-105 hover:shadow-md"
              >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#4b7c29] to-emerald-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm font-medium text-gray-700">Portfolio</span>
              </a>
              
              {socialLinks?.youtube && (
                <a 
                  href={socialLinks.youtube}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center p-4 rounded-xl bg-gradient-to-br from-red-50 to-orange-50 hover:from-red-100 hover:to-orange-100 transition-all duration-300 hover:scale-105 hover:shadow-md"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Youtube className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">YouTube</span>
                </a>
              )}
              
              {companyWebsite && (
                <a 
                  href={companyWebsite}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center p-4 rounded-xl bg-gradient-to-br from-blue-50 to-cyan-50 hover:from-blue-100 hover:to-cyan-100 transition-all duration-300 hover:scale-105 hover:shadow-md"
                >
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Website</span>
                </a>
              )}
              
              {socialLinks?.pinterest && (
                <a 
                  href={socialLinks.pinterest}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="group flex flex-col items-center p-4 rounded-xl bg-gradient-to-br from-red-50 to-pink-50 hover:from-red-100 hover:to-pink-100 transition-all duration-300 hover:scale-105 hover:shadow-md col-span-2 md:col-span-1"
                >
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-red-600 to-red-700 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                  <svg className="w-6 h-6 text-white" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 01.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12 0-6.628-5.373-12-12-12z"/>
                  </svg>
                </div>
                <span className="text-sm font-medium text-gray-700">Pinterest</span>
                </a>
              )}
            </div>
          </div>

          <div className="text-center">
            <p className="text-lg text-gray-600 mb-2">
              We'd love to hear about your dream event — let's start planning something extraordinary together. 💫
            </p>
            <p className="text-gray-500 italic">
              Warm regards,<br />
              <strong className="text-[#4b7c29]">Team {companyName}</strong><br />
              <span className="text-sm">Where every detail tells a story...</span>
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-4">Why Choose Us?</h3>
          <p className="text-center text-gray-600 mb-12 max-w-2xl mx-auto">
            With years of experience and hundreds of successful events, we're Kerala's trusted partner for memorable celebrations.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center p-6">
              <div className="text-4xl font-bold text-[#4b7c29] mb-2">500+</div>
              <div className="text-gray-600">Events Decorated</div>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl font-bold text-[#4b7c29] mb-2">8+</div>
              <div className="text-gray-600">Years Experience</div>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl font-bold text-[#4b7c29] mb-2">50+</div>
              <div className="text-gray-600">Premium Venues</div>
            </div>
            <div className="text-center p-6">
              <div className="text-4xl font-bold text-[#4b7c29] mb-2">4.9★</div>
              <div className="text-gray-600">Client Rating</div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-4">Our Work</h3>
          <p className="text-center text-gray-600 mb-12">A glimpse of our recent celebrations</p>
          {portfolioAlbums.length > 0 ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {portfolioAlbums.slice(0, 6).map((album) => (
                  <Link key={album.id} href={`/portfolio/${album.id}`}>
                    <div className="relative group overflow-hidden rounded-lg aspect-[4/3] cursor-pointer">
                      <img 
                        src={convertToDirectImageUrl(album.coverImageUrl)} 
                        alt={album.title}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Image+Not+Found'; }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent flex flex-col justify-end p-4">
                        <div className="text-white">
                          <div className="font-bold text-lg uppercase tracking-wide">{album.title}</div>
                          {album.tagline && (
                            <div className="text-sm text-white/90 italic mt-1">"{album.tagline}"</div>
                          )}
                          {album.venue && (
                            <div className="text-sm text-white/80 flex items-center gap-1 mt-1">
                              <MapPin className="w-3 h-3" /> {album.venue}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="text-center mt-8">
                <Link href="/portfolio">
                  <Button variant="outline" className="border-[#4b7c29] text-[#4b7c29] hover:bg-green-50">
                    View More <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <Camera className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>Portfolio coming soon...</p>
            </div>
          )}
        </div>
      </section>

      <section className="py-16 px-4 bg-white">
        <div className="max-w-6xl mx-auto">
          <h3 className="text-2xl font-bold text-center text-gray-900 mb-4">Our Services</h3>
          <p className="text-center text-gray-600 mb-12">Complete wedding planning & event management solutions</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {SERVICES.map(service => {
              const Icon = service.icon;
              return (
                <div key={service.id} className="flex items-center gap-3 p-4 bg-white border border-gray-100 rounded-lg hover:border-[#4b7c29]/30 hover:shadow-md transition-all">
                  <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center flex-shrink-0">
                    <Icon className="w-5 h-5 text-[#4b7c29]" />
                  </div>
                  <span className="text-sm font-medium text-gray-700">{service.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-20 px-4 bg-[#4b7c29] text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-3xl font-bold mb-4">Ready to Start Planning?</h3>
          <p className="text-xl text-white/80 mb-8">
            Share your vision with us and let's create something beautiful together.
          </p>
          <Button 
            size="lg" 
            variant="secondary"
            onClick={() => setStep("form")}
            className="text-lg px-8 py-6"
            data-testid="button-plan-event"
          >
            Plan Your Event <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
        </div>
      </section>

      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h4 className="text-lg font-semibold mb-4">{companyName}</h4>
              <p className="text-gray-400 text-sm">
                Crafting memorable celebrations. From intimate gatherings to grand weddings, we bring your dreams to life.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Contact</h4>
              <div className="space-y-2 text-gray-400 text-sm">
                {companyPhone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4" /> {companyPhone}
                  </div>
                )}
                {companyEmail && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4" /> {companyEmail}
                  </div>
                )}
                {companySettings?.address && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4" /> {companySettings.address}
                  </div>
                )}
              </div>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Follow Us</h4>
              <div className="flex gap-4">
                {socialLinks?.instagram && (
                  <a href={socialLinks.instagram} target="_blank" rel="noopener" className="text-gray-400 hover:text-white">
                    <Instagram className="w-6 h-6" />
                  </a>
                )}
                {socialLinks?.facebook && (
                  <a href={socialLinks.facebook} target="_blank" rel="noopener" className="text-gray-400 hover:text-white">
                    <Facebook className="w-6 h-6" />
                  </a>
                )}
                {socialLinks?.youtube && (
                  <a href={socialLinks.youtube} target="_blank" rel="noopener" className="text-gray-400 hover:text-white">
                    <Youtube className="w-6 h-6" />
                  </a>
                )}
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} {companyName}. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Calendar, MapPin, Users, UtensilsCrossed, Check, X, HelpCircle, Loader2, Download, Plane, Hotel, Car, Compass } from "lucide-react";

const OAK_GREEN = "#2FA4BC";
const OAK_GREEN_DARK = "#1a8a9e";
const OAK_GREEN_LIGHT = "#e0f4f8";

interface GuestData {
  id: string;
  name: string;
  eventId: string;
  maxAttendees: number;
  event: {
    id: string;
    title: string;
    date: string;
    venue?: string;
    customer?: string;
    rsvpTitle?: string;
    rsvpFunctions?: string[];
  };
  existingResponse?: {
    attendanceStatus: string;
    numberOfAttendees: number;
    mealPreference?: string;
    specialNotes?: string;
    attendingWedding?: boolean;
    attendingEngagement?: boolean;
    attendingFunctions?: string[];
    needsAirportPickup?: boolean;
    pickupFlightTrainNo?: string;
    pickupPoint?: string;
    pickupDate?: string;
    pickupTime?: string;
    pickupContactPerson?: string;
    needsAccommodation?: boolean;
    accommodationHotelName?: string;
    accommodationCheckIn?: string;
    accommodationCheckOut?: string;
    accommodationRooms?: number;
    needsTransport?: boolean;
    transportVehicleNo?: string;
    transportDriverNo?: string;
    transportPickupTime?: string;
    transportDropTime?: string;
    plansTourAfterEvent?: boolean;
    tourPeopleCount?: number;
    tourDaysCount?: number;
    tourPlans?: string;
  };
}

export default function RsvpResponse() {
  const [, params] = useRoute("/rsvp/:token");
  const token = params?.token;
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guestData, setGuestData] = useState<GuestData | null>(null);
  
  const [attendance, setAttendance] = useState<string>("");
  const [guestCount, setGuestCount] = useState(1);
  const [adultCount, setAdultCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [mealPreference, setMealPreference] = useState<string>("");
  const [specialNotes, setSpecialNotes] = useState("");
  
  const [attendingWedding, setAttendingWedding] = useState(false);
  const [attendingEngagement, setAttendingEngagement] = useState(false);
  const [selectedFunctions, setSelectedFunctions] = useState<string[]>([]);
  
  const [needsAirportPickup, setNeedsAirportPickup] = useState(false);
  const [pickupFlightTrainNo, setPickupFlightTrainNo] = useState("");
  const [pickupPoint, setPickupPoint] = useState("");
  const [pickupDate, setPickupDate] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [pickupContactPerson, setPickupContactPerson] = useState("");
  
  const [needsAccommodation, setNeedsAccommodation] = useState(false);
  const [accommodationCheckIn, setAccommodationCheckIn] = useState("");
  const [accommodationCheckOut, setAccommodationCheckOut] = useState("");
  const [accommodationRooms, setAccommodationRooms] = useState(1);
  
  const [needsTransport, setNeedsTransport] = useState(false);
  const [transportPickupTime, setTransportPickupTime] = useState("");
  const [transportDropTime, setTransportDropTime] = useState("");
  
  const [plansTourAfterEvent, setPlansTourAfterEvent] = useState(false);
  const [tourPeopleCount, setTourPeopleCount] = useState(1);
  const [tourDaysCount, setTourDaysCount] = useState(1);
  const [tourPlans, setTourPlans] = useState("");
  
  const { toast } = useToast();

  useEffect(() => {
    if (!token) return;
    
    const fetchGuestData = async () => {
      try {
        const res = await fetch(`/api/rsvp/public/${token}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError("This RSVP link is invalid or has expired.");
          } else {
            setError("Unable to load RSVP information. Please try again.");
          }
          setLoading(false);
          return;
        }
        
        const data = await res.json();
        setGuestData(data);
        
        if (data.existingResponse) {
          const r = data.existingResponse;
          setAttendance(r.attendanceStatus);
          setGuestCount(r.numberOfAttendees || 1);
          setAdultCount(r.numberOfAdults || r.numberOfAttendees || 1);
          setChildrenCount(r.numberOfChildren || 0);
          setMealPreference(r.mealPreference || "");
          setSpecialNotes(r.specialNotes || "");
          setAttendingWedding(r.attendingWedding || false);
          setAttendingEngagement(r.attendingEngagement || false);
          if (r.attendingFunctions) {
            setSelectedFunctions(r.attendingFunctions);
          } else {
            const legacy: string[] = [];
            if (r.attendingWedding) legacy.push('Wedding');
            if (r.attendingEngagement) legacy.push('Engagement / Reception');
            setSelectedFunctions(legacy);
          }
          setNeedsAirportPickup(r.needsAirportPickup || false);
          setPickupFlightTrainNo(r.pickupFlightTrainNo || "");
          setPickupPoint(r.pickupPoint || "");
          setPickupDate(r.pickupDate || "");
          setPickupTime(r.pickupTime || "");
          setPickupContactPerson(r.pickupContactPerson || "");
          setNeedsAccommodation(r.needsAccommodation || false);
          setAccommodationCheckIn(r.accommodationCheckIn || "");
          setAccommodationCheckOut(r.accommodationCheckOut || "");
          setAccommodationRooms(r.accommodationRooms || 1);
          setNeedsTransport(r.needsTransport || false);
          setTransportPickupTime(r.transportPickupTime || "");
          setTransportDropTime(r.transportDropTime || "");
          setPlansTourAfterEvent(r.plansTourAfterEvent || false);
          setTourPeopleCount(r.tourPeopleCount || 1);
          setTourDaysCount(r.tourDaysCount || 1);
          setTourPlans(r.tourPlans || "");
        }
        
        setLoading(false);
      } catch (err) {
        setError("Unable to load RSVP information. Please try again.");
        setLoading(false);
      }
    };
    
    fetchGuestData();
  }, [token]);

  const handleSubmit = async () => {
    if (!attendance) {
      toast({
        title: "Please select your attendance",
        variant: "destructive",
      });
      return;
    }
    
    setSubmitting(true);
    
    try {
      const res = await fetch(`/api/rsvp/public/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceStatus: attendance,
          numberOfAttendees: attendance === "yes" ? (adultCount + childrenCount) : 0,
          numberOfAdults: attendance === "yes" ? adultCount : 0,
          numberOfChildren: attendance === "yes" ? childrenCount : 0,
          mealPreference: attendance === "yes" ? mealPreference : null,
          specialNotes,
          attendingWedding: attendance === "yes" ? selectedFunctions.includes('Wedding') : false,
          attendingEngagement: attendance === "yes" ? selectedFunctions.includes('Engagement / Reception') : false,
          attendingFunctions: attendance === "yes" ? selectedFunctions : [],
          needsAirportPickup: attendance === "yes" ? needsAirportPickup : false,
          pickupFlightTrainNo: needsAirportPickup ? pickupFlightTrainNo : null,
          pickupPoint: needsAirportPickup ? pickupPoint : null,
          pickupDate: needsAirportPickup ? pickupDate : null,
          pickupTime: needsAirportPickup ? pickupTime : null,
          pickupContactPerson: needsAirportPickup ? pickupContactPerson : null,
          needsAccommodation: attendance === "yes" ? needsAccommodation : false,
          accommodationCheckIn: needsAccommodation ? accommodationCheckIn : null,
          accommodationCheckOut: needsAccommodation ? accommodationCheckOut : null,
          accommodationRooms: needsAccommodation ? accommodationRooms : null,
          needsTransport: attendance === "yes" ? needsTransport : false,
          transportPickupTime: needsTransport ? transportPickupTime : null,
          transportDropTime: needsTransport ? transportDropTime : null,
          plansTourAfterEvent: attendance === "yes" ? plansTourAfterEvent : false,
          tourPeopleCount: plansTourAfterEvent ? tourPeopleCount : null,
          tourDaysCount: plansTourAfterEvent ? tourDaysCount : null,
          tourPlans: plansTourAfterEvent ? tourPlans : null,
        }),
      });
      
      if (!res.ok) {
        throw new Error("Failed to submit response");
      }
      
      setSubmitted(true);
      toast({
        title: "Thank you!",
        description: "Your RSVP has been recorded.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to submit your response. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: OAK_GREEN_LIGHT }}>
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: OAK_GREEN }} />
            <span className="ml-3 text-gray-600">Loading your invitation...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: OAK_GREEN_LIGHT }}>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <X className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">Invalid Link</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const handleDownloadConfirmation = () => {
    if (!guestData) return;
    
    const eventDate = guestData.event.date ? parseISO(guestData.event.date) : null;
    const eventDateStr = eventDate ? format(eventDate, "EEEE, MMMM d, yyyy") : 'Date TBD';
    const coupleNameDl = (() => {
      if (guestData.event.rsvpTitle) {
        const match = guestData.event.rsvpTitle.match(/(?:celebration|wedding|marriage|engagement)\s+of\s+(.+?)\.?\s*$/i);
        if (match) return match[1].trim();
      }
      return guestData.event.customer || guestData.event.title;
    })();
    
    const confirmationContent = `
═══════════════════════════════════════════════════
                 RSVP CONFIRMATION
═══════════════════════════════════════════════════

Event: ${coupleNameDl}
Date: ${eventDateStr}
${guestData.event.venue ? `Venue: ${guestData.event.venue}` : ''}

───────────────────────────────────────────────────

Guest Name: ${guestData.name}
Status: ${attendance === 'yes' ? '✓ ATTENDING' : attendance === 'no' ? '✗ NOT ATTENDING' : '? MAYBE'}
${attendance === 'yes' ? `Adults: ${adultCount} | Children: ${childrenCount} | Total: ${adultCount + childrenCount}` : ''}
${attendance === 'yes' && mealPreference ? `Meal Preference: ${mealPreference === 'vegetarian' ? 'Vegetarian' : 'Non-Vegetarian'}` : ''}
${specialNotes ? `Notes: ${specialNotes}` : ''}

───────────────────────────────────────────────────

Confirmed on: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}

═══════════════════════════════════════════════════
           Managed by KnotVite

═══════════════════════════════════════════════════
    `.trim();
    
    const blob = new Blob([confirmationContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RSVP-Confirmation-${guestData.name.replace(/\s+/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#f5f7f2' }}>
        <div className="w-full max-w-md animate-in fade-in slide-in-from-bottom-3 duration-500 text-center" style={{ borderRadius: '14px', backgroundColor: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', padding: '32px 24px' }}>
          <div className="h-12 w-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#f0f5eb' }}>
            <Check className="h-6 w-6" style={{ color: OAK_GREEN }} />
          </div>
          <h3 className="text-xl font-semibold mb-1.5" style={{ color: OAK_GREEN }}>Thank You!</h3>
          <p className="text-[14px] leading-relaxed" style={{ color: '#999' }}>
            Your RSVP for {guestData?.event.rsvpTitle || guestData?.event.customer || guestData?.event.title} has been recorded.
          </p>
          <p className="text-[14px] mt-2" style={{ color: '#999' }}>
            {attendance === "yes" ? "We look forward to celebrating with you!" : attendance === "no" ? "We're sorry you won't be able to make it." : "We hope you can join us."}
          </p>
          {attendance === "yes" && (
            <div className="pt-5 mt-5" style={{ borderTop: '1px solid #f0f0f0' }}>
              <Button onClick={handleDownloadConfirmation} className="text-white hover:brightness-110" style={{ backgroundColor: OAK_GREEN, borderRadius: '10px', height: '44px', fontSize: '14px' }} data-testid="button-download-confirmation">
                <Download className="h-4 w-4 mr-1.5" />Download Confirmation
              </Button>
              <p className="text-[12px] mt-2" style={{ color: '#bbb' }}>Save this as proof of your RSVP</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!guestData) return null;

  const eventDate = guestData.event.date ? parseISO(guestData.event.date) : null;
  const displayTitle = (() => {
    if (guestData.event.rsvpTitle) {
      const match = guestData.event.rsvpTitle.match(/(?:celebration|wedding|marriage|engagement)\s+of\s+(.+?)\.?\s*$/i);
      if (match) return match[1].trim();
    }
    return guestData.event.customer || guestData.event.title;
  })();

  return (
    <div className="min-h-screen py-6 sm:py-10 px-3 sm:px-4" style={{ backgroundColor: '#f5f7f2' }}>
      <div className="max-w-lg mx-auto space-y-6">

        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500" style={{ borderRadius: '16px', backgroundColor: '#5a8a35', boxShadow: '0 2px 12px rgba(0,0,0,0.08)' }}>
          <div className="px-4 sm:px-8 py-6 sm:py-9 text-center text-white">
            <p className="text-[13px] mb-3 font-light tracking-wide" style={{ color: 'rgba(255,255,255,0.7)', fontFamily: "'Inter', system-ui, sans-serif" }}>
              Together with their families
            </p>
            <h2 className="text-[24px] sm:text-[34px] mb-3" style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontWeight: 400, lineHeight: 1.25, letterSpacing: '0.01em' }}>
              {displayTitle}
            </h2>
            <p className="text-[13px] mb-5 font-light" style={{ color: 'rgba(255,255,255,0.75)', fontFamily: "'Inter', system-ui, sans-serif" }}>
              cordially invite you to celebrate their wedding
            </p>
            <div className="flex items-center justify-center gap-3 mb-5">
              <div className="h-px flex-1 max-w-[40px]" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} />
              <div className="h-1 w-1 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.4)' }} />
              <div className="h-px flex-1 max-w-[40px]" style={{ backgroundColor: 'rgba(255,255,255,0.25)' }} />
            </div>
            <div className="flex items-center justify-center gap-5 text-[12.5px] font-light" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {eventDate && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" style={{ color: 'rgba(255,255,255,0.5)' }} />
                  {format(eventDate, "MMMM d, yyyy")}
                </span>
              )}
              {guestData.event.venue && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" style={{ color: 'rgba(255,255,255,0.5)' }} />
                    {guestData.event.venue}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150" style={{ borderRadius: '14px', backgroundColor: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div className="px-4 sm:px-8 pt-6 pb-1">
            <p className="text-[14px] text-center" style={{ color: '#666' }}>Dear <span className="font-semibold" style={{ color: '#222' }}>{guestData.name}</span>, will you be attending?</p>
          </div>
          <div className="px-4 sm:px-8 pb-7 pt-4 space-y-5">

              <RadioGroup value={attendance} onValueChange={setAttendance} className="grid grid-cols-3 gap-3" data-testid="radio-attendance">
                <div>
                  <RadioGroupItem value="yes" id="yes" className="peer sr-only" data-testid="radio-attendance-yes" />
                  <Label htmlFor="yes" className="flex flex-col items-center justify-center p-2.5 sm:p-3.5 min-h-[48px] cursor-pointer transition-all duration-200" style={{ borderRadius: '10px', border: '1.5px solid', borderColor: attendance === 'yes' ? OAK_GREEN : '#e0e0e0', backgroundColor: attendance === 'yes' ? '#f0f5eb' : 'white' }}>
                    <Check className="h-5 w-5 sm:h-6 sm:w-6 mb-1.5" style={{ color: OAK_GREEN }} /><span className="font-medium text-[11px] sm:text-[13px]">Attending</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="no" id="no" className="peer sr-only" data-testid="radio-attendance-no" />
                  <Label htmlFor="no" className="flex flex-col items-center justify-center p-2.5 sm:p-3.5 min-h-[48px] cursor-pointer transition-all duration-200" style={{ borderRadius: '10px', border: '1.5px solid', borderColor: attendance === 'no' ? '#dc2626' : '#e0e0e0', backgroundColor: attendance === 'no' ? '#fef2f2' : 'white' }}>
                    <X className="h-5 w-5 sm:h-6 sm:w-6 mb-1.5 text-red-400" /><span className="font-medium text-[11px] sm:text-[13px]">Regret</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="maybe" id="maybe" className="peer sr-only" data-testid="radio-attendance-maybe" />
                  <Label htmlFor="maybe" className="flex flex-col items-center justify-center p-2.5 sm:p-3.5 min-h-[48px] cursor-pointer transition-all duration-200" style={{ borderRadius: '10px', border: '1.5px solid', borderColor: attendance === 'maybe' ? '#6b7280' : '#e0e0e0', backgroundColor: attendance === 'maybe' ? '#f9fafb' : 'white' }}>
                    <HelpCircle className="h-5 w-5 sm:h-6 sm:w-6 mb-1.5 text-gray-300" /><span className="font-medium text-[11px] sm:text-[13px]">Maybe</span>
                  </Label>
                </div>
              </RadioGroup>

              {attendance === "yes" && (
                <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="p-4" style={{ backgroundColor: '#f7faf4', borderRadius: '10px' }}>
                    <Label className="flex items-center gap-2 mb-3 font-medium text-[13px]" style={{ color: OAK_GREEN_DARK }}>
                      <Calendar className="h-3.5 w-3.5" />Which events will you attend?
                    </Label>
                    <div className="space-y-3">
                      {(guestData?.event?.rsvpFunctions || ['Wedding', 'Engagement / Reception']).map((fn, idx) => (
                        <div key={idx} className="flex items-center space-x-3">
                          <Checkbox
                            id={`attendFn-${idx}`}
                            checked={selectedFunctions.includes(fn)}
                            onCheckedChange={(checked) => {
                              setSelectedFunctions(prev =>
                                checked ? [...prev, fn] : prev.filter(f => f !== fn)
                              );
                            }}
                            data-testid={`checkbox-function-${idx}`}
                          />
                          <Label htmlFor={`attendFn-${idx}`} className="cursor-pointer text-[14px]">{fn}</Label>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="flex items-center gap-2 text-[13px] font-medium" style={{ color: '#444' }}><Users className="h-3.5 w-3.5" />Number of Guests</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3.5" style={{ borderRadius: '10px', border: '1.5px solid #e0e0e0' }}>
                        <Label className="text-[11px] font-medium mb-1.5 block" style={{ color: '#999' }}>Adults</Label>
                        <div className="flex items-center gap-2 justify-center">
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setAdultCount(Math.max(1, adultCount - 1))} disabled={adultCount <= 1} data-testid="button-decrease-adults">-</Button>
                          <span className="text-xl font-semibold w-7 text-center" data-testid="text-adult-count">{adultCount}</span>
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setAdultCount(adultCount + 1)} data-testid="button-increase-adults">+</Button>
                        </div>
                      </div>
                      <div className="p-3.5" style={{ borderRadius: '10px', border: '1.5px solid #e0e0e0' }}>
                        <Label className="text-[11px] font-medium mb-1.5 block" style={{ color: '#999' }}>Children (below 12)</Label>
                        <div className="flex items-center gap-2 justify-center">
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))} disabled={childrenCount <= 0} data-testid="button-decrease-children">-</Button>
                          <span className="text-xl font-semibold w-7 text-center" data-testid="text-children-count">{childrenCount}</span>
                          <Button type="button" variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={() => setChildrenCount(childrenCount + 1)} data-testid="button-increase-children">+</Button>
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-center" style={{ color: '#bbb' }}>Total: {adultCount + childrenCount} guest{adultCount + childrenCount !== 1 ? 's' : ''}</p>
                  </div>

                  <div>
                    <Label className="flex items-center gap-2 mb-2.5 text-[13px] font-medium" style={{ color: '#444' }}><UtensilsCrossed className="h-3.5 w-3.5" />Meal Preference</Label>
                    <RadioGroup value={mealPreference} onValueChange={setMealPreference} className="grid grid-cols-2 gap-3" data-testid="radio-meal">
                      <div>
                        <RadioGroupItem value="vegetarian" id="veg" className="peer sr-only" data-testid="radio-meal-veg" />
                        <Label htmlFor="veg" className="flex items-center justify-center p-3 cursor-pointer transition-all duration-200" style={{ borderRadius: '10px', border: '1.5px solid', borderColor: mealPreference === 'vegetarian' ? OAK_GREEN : '#e0e0e0', backgroundColor: mealPreference === 'vegetarian' ? '#f0f5eb' : 'white' }}>
                          <span className="h-2 w-2 rounded-full mr-2" style={{ backgroundColor: OAK_GREEN }}></span><span className="text-[13px] font-medium">Vegetarian</span>
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem value="non_vegetarian" id="nonveg" className="peer sr-only" data-testid="radio-meal-nonveg" />
                        <Label htmlFor="nonveg" className="flex items-center justify-center p-3 cursor-pointer transition-all duration-200" style={{ borderRadius: '10px', border: '1.5px solid', borderColor: mealPreference === 'non_vegetarian' ? '#dc2626' : '#e0e0e0', backgroundColor: mealPreference === 'non_vegetarian' ? '#fef2f2' : 'white' }}>
                          <span className="h-2 w-2 rounded-full bg-red-400 mr-2"></span><span className="text-[13px] font-medium">Non-Vegetarian</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="pt-2" style={{ borderTop: '1px solid #f0f0f0' }}>
                    <h3 className="text-[14px] font-semibold mb-1" style={{ color: OAK_GREEN_DARK }}>Travel & Logistics</h3>
                    <p className="text-[13px] mb-4" style={{ color: '#999' }}>Help us plan your comfortable stay.</p>

                    <div className="space-y-3">
                      <div className="p-4" style={{ borderRadius: '10px', border: '1.5px solid #e0e0e0' }}>
                        <div className="flex items-center space-x-3 mb-2">
                          <Checkbox id="needsPickup" checked={needsAirportPickup} onCheckedChange={(checked) => setNeedsAirportPickup(checked as boolean)} data-testid="checkbox-needs-pickup" />
                          <Label htmlFor="needsPickup" className="cursor-pointer flex items-center gap-2 font-medium text-[14px]">
                            <Plane className="h-3.5 w-3.5" style={{ color: OAK_GREEN }} />Airport / Station Pickup
                          </Label>
                        </div>
                        {needsAirportPickup && (
                          <div className="ml-0 sm:ml-7 space-y-3 animate-in fade-in duration-200">
                            <div><Label className="text-sm" style={{ color: '#666' }}>Flight / Train Number</Label><Input value={pickupFlightTrainNo} onChange={(e) => setPickupFlightTrainNo(e.target.value)} placeholder="e.g. AI-505 or 12625" style={{ borderRadius: '10px', height: '44px' }} data-testid="input-flight-train" /></div>
                            <div><Label className="text-sm" style={{ color: '#666' }}>Pickup Point</Label><Input value={pickupPoint} onChange={(e) => setPickupPoint(e.target.value)} placeholder="e.g. Cochin International Airport" style={{ borderRadius: '10px', height: '44px' }} data-testid="input-pickup-point" /></div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div><Label className="text-sm" style={{ color: '#666' }}>Arrival Date</Label><Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} style={{ borderRadius: '10px', height: '44px' }} data-testid="input-pickup-date" /></div>
                              <div><Label className="text-sm" style={{ color: '#666' }}>Arrival Time</Label><Input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} style={{ borderRadius: '10px', height: '44px' }} data-testid="input-pickup-time" /></div>
                            </div>
                            <div><Label className="text-sm" style={{ color: '#666' }}>Contact Person</Label><Input value={pickupContactPerson} onChange={(e) => setPickupContactPerson(e.target.value)} placeholder="Person to contact" style={{ borderRadius: '10px', height: '44px' }} data-testid="input-pickup-contact" /></div>
                          </div>
                        )}
                      </div>

                      <div className="p-4" style={{ borderRadius: '10px', border: '1.5px solid #e0e0e0' }}>
                        <div className="flex items-center space-x-3 mb-2">
                          <Checkbox id="needsStay" checked={needsAccommodation} onCheckedChange={(checked) => setNeedsAccommodation(checked as boolean)} data-testid="checkbox-needs-accommodation" />
                          <Label htmlFor="needsStay" className="cursor-pointer flex items-center gap-2 font-medium text-[14px]">
                            <Hotel className="h-3.5 w-3.5" style={{ color: OAK_GREEN }} />Accommodation
                          </Label>
                        </div>
                        {needsAccommodation && (
                          <div className="ml-0 sm:ml-7 space-y-3 animate-in fade-in duration-200">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div><Label className="text-sm" style={{ color: '#666' }}>Check-in</Label><Input type="date" value={accommodationCheckIn} onChange={(e) => setAccommodationCheckIn(e.target.value)} style={{ borderRadius: '10px', height: '44px' }} data-testid="input-check-in" /></div>
                              <div><Label className="text-sm" style={{ color: '#666' }}>Check-out</Label><Input type="date" value={accommodationCheckOut} onChange={(e) => setAccommodationCheckOut(e.target.value)} style={{ borderRadius: '10px', height: '44px' }} data-testid="input-check-out" /></div>
                            </div>
                            <div><Label className="text-sm" style={{ color: '#666' }}>Rooms Needed</Label><Input type="number" min="1" value={accommodationRooms} onChange={(e) => setAccommodationRooms(parseInt(e.target.value) || 1)} style={{ borderRadius: '10px', height: '44px' }} data-testid="input-rooms" /></div>
                          </div>
                        )}
                      </div>

                      <div className="p-4" style={{ borderRadius: '10px', border: '1.5px solid #e0e0e0' }}>
                        <div className="flex items-center space-x-3 mb-2">
                          <Checkbox id="needsTransport" checked={needsTransport} onCheckedChange={(checked) => setNeedsTransport(checked as boolean)} data-testid="checkbox-needs-transport" />
                          <Label htmlFor="needsTransport" className="cursor-pointer flex items-center gap-2 font-medium text-[14px]">
                            <Car className="h-3.5 w-3.5" style={{ color: OAK_GREEN }} />Local Transport
                          </Label>
                        </div>
                        {needsTransport && (
                          <div className="ml-0 sm:ml-7 space-y-3 animate-in fade-in duration-200">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div><Label className="text-sm" style={{ color: '#666' }}>Pickup Time</Label><Input type="time" value={transportPickupTime} onChange={(e) => setTransportPickupTime(e.target.value)} style={{ borderRadius: '10px', height: '44px' }} data-testid="input-transport-pickup" /></div>
                              <div><Label className="text-sm" style={{ color: '#666' }}>Drop Time</Label><Input type="time" value={transportDropTime} onChange={(e) => setTransportDropTime(e.target.value)} style={{ borderRadius: '10px', height: '44px' }} data-testid="input-transport-drop" /></div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="p-4" style={{ borderRadius: '10px', border: '1.5px solid #e0e0e0' }}>
                        <div className="flex items-center space-x-3 mb-2">
                          <Checkbox id="plansTour" checked={plansTourAfterEvent} onCheckedChange={(checked) => setPlansTourAfterEvent(checked as boolean)} data-testid="checkbox-plans-tour" />
                          <Label htmlFor="plansTour" className="cursor-pointer flex items-center gap-2 font-medium text-[14px]">
                            <Compass className="h-3.5 w-3.5" style={{ color: OAK_GREEN }} />Tour after the event
                          </Label>
                        </div>
                        {plansTourAfterEvent && (
                          <div className="ml-0 sm:ml-7 space-y-3 animate-in fade-in duration-200">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div><Label className="text-sm" style={{ color: '#666' }}>People</Label><Input type="number" min="1" value={tourPeopleCount} onChange={(e) => setTourPeopleCount(parseInt(e.target.value) || 1)} style={{ borderRadius: '10px', height: '44px' }} data-testid="input-tour-people" /></div>
                              <div><Label className="text-sm" style={{ color: '#666' }}>Days</Label><Input type="number" min="1" value={tourDaysCount} onChange={(e) => setTourDaysCount(parseInt(e.target.value) || 1)} style={{ borderRadius: '10px', height: '44px' }} data-testid="input-tour-days" /></div>
                            </div>
                            <div><Label className="text-sm" style={{ color: '#666' }}>Tour Preferences</Label><Textarea value={tourPlans} onChange={(e) => setTourPlans(e.target.value)} placeholder="Places you'd like to visit?" rows={2} className="resize-none" style={{ borderRadius: '10px' }} data-testid="input-tour-plans" /></div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label htmlFor="notes" className="mb-1.5 block text-[13px] font-medium" style={{ color: '#444' }}>Special Notes or Requests</Label>
                <Textarea id="notes" value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} placeholder="Any dietary requirements or special requests..." className="resize-none" rows={3} style={{ borderRadius: '10px', fontSize: '14px' }} data-testid="input-special-notes" />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting || !attendance}
                className="w-full text-white font-medium transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
                style={{ backgroundColor: OAK_GREEN, height: '50px', borderRadius: '10px', fontSize: '15px' }}
                data-testid="button-submit-rsvp"
              >
                {submitting ? (<><Loader2 className="h-4 w-4 animate-spin mr-2" />Submitting...</>) : "Confirm RSVP"}
              </Button>
          </div>
        </div>

        <p className="text-center text-xs tracking-wide" style={{ color: '#bbb' }}>
          Powered by <span style={{ color: '#999' }}>KnotVite</span>
        </p>
      </div>
    </div>
  );
}
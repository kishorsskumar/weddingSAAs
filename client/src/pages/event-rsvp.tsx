import { useState, useEffect, useMemo } from "react";
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
import { Calendar, MapPin, Users, UtensilsCrossed, Check, X, HelpCircle, Loader2, Download, Plane, Hotel, Car, Compass, Search, ArrowLeft, User, UserPlus, ArrowRight, MessageSquare } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OAK_GREEN = "#4b7c29";
const OAK_GREEN_DARK = "#3d6622";
const OAK_GREEN_LIGHT = "#e8f0e0";
const GOLD_ACCENT = "#c9a84c";

interface FormPageSettings {
  headerTopLine?: string;
  headerInvitationText?: string;
  confirmationPrompt?: string;
  searchPrompt?: string;
  thankYouAttending?: string;
  thankYouNotAttending?: string;
  functionDetails?: Record<string, { date?: string; time?: string; venue?: string }>;
  showEventsSection?: boolean;
  showGuestCount?: boolean;
  showMealPreference?: boolean;
  showPickupSection?: boolean;
  hidePickupContactPerson?: boolean;
  showAccommodationSection?: boolean;
  hideRoomsNeeded?: boolean;
  showTransportSection?: boolean;
  showTourSection?: boolean;
  showDepartureSection?: boolean;
  showSecondaryContactSection?: boolean;
  hideAlternateContactName?: boolean;
  showHotelAllocationSection?: boolean;
  showSpecialNotes?: boolean;
  showDressCode?: boolean;
  dressCodeText?: string;
  showDietaryRestrictions?: boolean;
  showWhatsAppField?: boolean;
}

interface RsvpSettings {
  hideTourSection?: boolean;
  showDepartureDetails?: boolean;
  showSecondaryContact?: boolean;
  showHotelAllocation?: boolean;
  hotelOptions?: string[];
  localTransportContactName?: string;
  localTransportContactPhone?: string;
  reminderEnabled?: boolean;
  reminderDays?: number;
  formPage?: FormPageSettings;
}

interface EventInfo {
  eventId: string;
  title: string;
  customer: string;
  date: string;
  time?: string;
  venue?: string;
  type?: string;
  rsvpTitle?: string;
  rsvpFunctions?: string[];
  rsvpSettings?: RsvpSettings;
}

interface GuestMatch {
  id: string;
  name: string;
  maxAttendees: number;
}

interface ExistingResponse {
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
  accommodationCheckIn?: string;
  accommodationCheckOut?: string;
  accommodationRooms?: number;
  needsTransport?: boolean;
  transportPickupDate?: string;
  transportPickupTime?: string;
  transportDropDate?: string;
  transportDropTime?: string;
  plansTourAfterEvent?: boolean;
  tourPeopleCount?: number;
  tourDaysCount?: number;
  tourPlans?: string;
  alternateContactName?: string;
  alternateContactPhone?: string;
  departureFlightTrainNo?: string;
  departureDate?: string;
  departureTime?: string;
  departurePoint?: string;
  hotelSelection?: string;
  dietaryRestrictions?: string;
  whatsAppNumber?: string;
}

type Step = "search" | "form" | "submitted";

export default function EventRsvp() {
  const [, respondParams] = useRoute("/rsvp/e/:code/respond");
  const [, directParams] = useRoute("/rsvp/e/:code");
  const code = respondParams?.code || directParams?.code || "";
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [step, setStep] = useState<Step>("search");
  
  const [searchName, setSearchName] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<GuestMatch[]>([]);
  const [searchDone, setSearchDone] = useState(false);
  
  const [selectedGuest, setSelectedGuest] = useState<GuestMatch | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [attendance, setAttendance] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [adultCount, setAdultCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [mealPreference, setMealPreference] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [selfRegName, setSelfRegName] = useState("");
  const [selfRegPhone, setSelfRegPhone] = useState("");
  const [selfRegistering, setSelfRegistering] = useState(false);
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
  const [transportPickupDate, setTransportPickupDate] = useState("");
  const [transportPickupTime, setTransportPickupTime] = useState("");
  const [transportDropDate, setTransportDropDate] = useState("");
  const [transportDropTime, setTransportDropTime] = useState("");
  const [plansTourAfterEvent, setPlansTourAfterEvent] = useState(false);
  const [tourPeopleCount, setTourPeopleCount] = useState(1);
  const [tourDaysCount, setTourDaysCount] = useState(1);
  const [tourPlans, setTourPlans] = useState("");
  const [alternateContactName, setAlternateContactName] = useState("");
  const [alternateContactPhone, setAlternateContactPhone] = useState("");
  const [departureFlightTrainNo, setDepartureFlightTrainNo] = useState("");
  const [departureDate, setDepartureDate] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [departurePoint, setDeparturePoint] = useState("");
  const [hotelSelection, setHotelSelection] = useState("");
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [whatsAppNumber, setWhatsAppNumber] = useState("");
  
  const { toast } = useToast();
  
  const rsvpSettings = eventInfo?.rsvpSettings || {};
  const formPage = rsvpSettings.formPage || {} as FormPageSettings;
  
  const showSection = useMemo(() => {
    const fp = formPage;
    const legacy = rsvpSettings;
    const legacyTravel = (fp as any).showTravelSection;
    const travelDefault = legacyTravel !== undefined ? legacyTravel : true;
    return {
      pickup: fp.showPickupSection !== undefined ? fp.showPickupSection : travelDefault,
      accommodation: fp.showAccommodationSection !== undefined ? fp.showAccommodationSection : travelDefault,
      transport: fp.showTransportSection !== undefined ? fp.showTransportSection : travelDefault,
      tour: fp.showTourSection !== undefined ? fp.showTourSection : (legacy.hideTourSection ? false : travelDefault),
      departure: fp.showDepartureSection !== undefined ? fp.showDepartureSection : !!legacy.showDepartureDetails,
      secondaryContact: fp.showSecondaryContactSection !== undefined ? fp.showSecondaryContactSection : !!legacy.showSecondaryContact,
      hotelAllocation: fp.showHotelAllocationSection !== undefined ? fp.showHotelAllocationSection : !!legacy.showHotelAllocation,
    };
  }, [formPage, rsvpSettings]);

  useEffect(() => {
    if (!code) return;
    
    const fetchEvent = async () => {
      try {
        const res = await fetch(`/api/rsvp/event/${code}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Invalid RSVP link");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setEventInfo(data);
        setLoading(false);

        const params = new URLSearchParams(window.location.search);
        const guestId = params.get('guest');
        if (guestId) {
          try {
            const gRes = await fetch(`/api/rsvp/event/${code}/guest/${guestId}`);
            if (gRes.ok) {
              const gData = await gRes.json();
              if (gData.guest) {
                const guest: GuestMatch = { id: gData.guest.id, name: gData.guest.name, phone: gData.guest.phone || '' };
                setSelectedGuest(guest);
                setStep("form");
                if (gData.existingResponse) {
                  const r = gData.existingResponse;
                  setAttendance(r.attendanceStatus || "");
                  setGuestCount(r.numberOfAttendees || 1);
                  setAdultCount(r.numberOfAdults || r.numberOfAttendees || 1);
                  setChildrenCount(r.numberOfChildren || 0);
                  setMealPreference(r.mealPreference || "");
                  setSpecialNotes(r.specialNotes || "");
                  if (r.attendingFunctions) setSelectedFunctions(r.attendingFunctions);
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
                  setTransportPickupDate(r.transportPickupDate || "");
                  setTransportPickupTime(r.transportPickupTime || "");
                  setTransportDropDate(r.transportDropDate || "");
                  setTransportDropTime(r.transportDropTime || "");
                  setPlansTourAfterEvent(r.plansTourAfterEvent || false);
                  setTourPeopleCount(r.tourPeopleCount || 1);
                  setTourDaysCount(r.tourDaysCount || 1);
                  setTourPlans(r.tourPlans || "");
                  setAlternateContactName(r.alternateContactName || "");
                  setAlternateContactPhone(r.alternateContactPhone || "");
                  setDepartureFlightTrainNo(r.departureFlightTrainNo || "");
                  setDepartureDate(r.departureDate || "");
                  setDepartureTime(r.departureTime || "");
                  setDeparturePoint(r.departurePoint || "");
                  setHotelSelection(r.hotelSelection || "");
                  setDietaryRestrictions(r.dietaryRestrictions || "");
                  setWhatsAppNumber(r.whatsAppNumber || r.whatsappNumberGuest || "");
                }
              }
            }
          } catch {}
        }
      } catch {
        setError("Unable to load event information.");
        setLoading(false);
      }
    };
    fetchEvent();
  }, [code]);

  const handleSearch = async () => {
    if (searchName.trim().length < 2) {
      toast({ title: "Please enter at least 2 characters", variant: "destructive" });
      return;
    }
    setSearching(true);
    setSearchDone(false);
    try {
      const res = await fetch(`/api/rsvp/event/${code}/search?name=${encodeURIComponent(searchName.trim())}`);
      const data = await res.json();
      setSearchResults(data.guests || []);
      setSearchDone(true);
    } catch {
      toast({ title: "Search failed. Please try again.", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleSelectGuest = async (guest: GuestMatch) => {
    setSelectedGuest(guest);
    setGuestCount(1);
    
    try {
      const res = await fetch(`/api/rsvp/event/${code}/guest/${guest.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.existingResponse) {
          const r = data.existingResponse;
          setAttendance(r.attendanceStatus || "");
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
          setTransportPickupDate(r.transportPickupDate || "");
          setTransportPickupTime(r.transportPickupTime || "");
          setTransportDropDate(r.transportDropDate || "");
          setTransportDropTime(r.transportDropTime || "");
          setPlansTourAfterEvent(r.plansTourAfterEvent || false);
          setTourPeopleCount(r.tourPeopleCount || 1);
          setTourDaysCount(r.tourDaysCount || 1);
          setTourPlans(r.tourPlans || "");
          setAlternateContactName(r.alternateContactName || "");
          setAlternateContactPhone(r.alternateContactPhone || "");
          setDepartureFlightTrainNo(r.departureFlightTrainNo || "");
          setDepartureDate(r.departureDate || "");
          setDepartureTime(r.departureTime || "");
          setDeparturePoint(r.departurePoint || "");
          setHotelSelection(r.hotelSelection || "");
          setDietaryRestrictions(r.dietaryRestrictions || "");
          setWhatsAppNumber(r.whatsAppNumber || "");
        }
      }
    } catch {}
    
    setStep("form");
  };

  const handleSubmit = async () => {
    if (!attendance || !selectedGuest) {
      toast({ title: "Please select your attendance", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/rsvp/event/${code}/respond/${selectedGuest.id}`, {
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
          transportPickupDate: needsTransport ? transportPickupDate : null,
          transportPickupTime: needsTransport ? transportPickupTime : null,
          transportDropDate: needsTransport ? transportDropDate : null,
          transportDropTime: needsTransport ? transportDropTime : null,
          plansTourAfterEvent: attendance === "yes" ? plansTourAfterEvent : false,
          tourPeopleCount: plansTourAfterEvent ? tourPeopleCount : null,
          tourDaysCount: plansTourAfterEvent ? tourDaysCount : null,
          tourPlans: plansTourAfterEvent ? tourPlans : null,
          alternateContactName: alternateContactName || null,
          alternateContactPhone: alternateContactPhone || null,
          departureFlightTrainNo: departureFlightTrainNo || null,
          departureDate: departureDate || null,
          departureTime: departureTime || null,
          departurePoint: departurePoint || null,
          hotelSelection: hotelSelection || null,
          dietaryRestrictions: dietaryRestrictions || null,
          whatsAppNumber: whatsAppNumber || null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setStep("submitted");
      toast({ title: "Thank you!", description: "Your RSVP has been recorded." });
    } catch {
      toast({ title: "Error", description: "Failed to submit. Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnotherGuest = () => {
    setStep("search");
    setSearchName("");
    setSearchResults([]);
    setSearchDone(false);
    setSelectedGuest(null);
    setAttendance("");
    setGuestCount(1);
    setAdultCount(1);
    setChildrenCount(0);
    setMealPreference("");
    setSpecialNotes("");
    setSelfRegName("");
    setSelfRegPhone("");
    setSelfRegistering(false);
    setAttendingWedding(false);
    setAttendingEngagement(false);
    setSelectedFunctions([]);
    setNeedsAirportPickup(false);
    setPickupFlightTrainNo("");
    setPickupPoint("");
    setPickupDate("");
    setPickupTime("");
    setPickupContactPerson("");
    setNeedsAccommodation(false);
    setAccommodationCheckIn("");
    setAccommodationCheckOut("");
    setAccommodationRooms(1);
    setNeedsTransport(false);
    setTransportPickupTime("");
    setTransportDropTime("");
    setPlansTourAfterEvent(false);
    setTourPeopleCount(1);
    setTourDaysCount(1);
    setTourPlans("");
    setAlternateContactName("");
    setAlternateContactPhone("");
    setDepartureFlightTrainNo("");
    setDepartureDate("");
    setDepartureTime("");
    setDeparturePoint("");
    setHotelSelection("");
    setDietaryRestrictions("");
    setWhatsAppNumber("");
  };

  const eventDate = eventInfo?.date ? parseISO(eventInfo.date) : null;
  const displayTitle = useMemo(() => {
    if (eventInfo?.rsvpTitle) {
      const match = eventInfo.rsvpTitle.match(/(?:celebration|wedding|marriage|engagement)\s+of\s+(.+?)\.?\s*$/i);
      if (match) return match[1].trim();
    }
    return eventInfo?.customer || eventInfo?.title || '';
  }, [eventInfo?.rsvpTitle, eventInfo?.customer, eventInfo?.title]);

  const fp = rsvpSettings.formPage || {} as FormPageSettings;
  const functionDetails = fp.functionDetails || {};

  const eventHeader = useMemo(() => {
    if (!eventInfo) return null;
    const fp = (eventInfo.rsvpSettings?.formPage || {}) as FormPageSettings;
    const fDetails = fp.functionDetails || {};
    const functions = eventInfo.rsvpFunctions || ['Wedding', 'Engagement / Reception'];
    return (
      <div style={{ borderRadius: '16px', background: 'linear-gradient(135deg, rgba(255,255,255,0.65) 0%, rgba(245,230,240,0.7) 50%, rgba(235,220,235,0.65) 100%)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(180,140,170,0.15), inset 0 1px 0 rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.4)' }}>
        <div className="px-4 sm:px-8 py-6 sm:py-9 text-center">
          <p className="text-[13px] mb-3 font-medium tracking-wide" style={{ color: 'rgba(100,60,90,0.85)', fontFamily: "'Inter', system-ui, sans-serif" }}>
            {fp.headerTopLine || 'Together with their families'}
          </p>
          <h2 className="text-[26px] sm:text-[34px] mb-3" style={{ fontFamily: "'Georgia', 'Times New Roman', serif", fontWeight: 600, lineHeight: 1.25, letterSpacing: '0.01em', color: '#3a2535' }}>
            {displayTitle}
          </h2>
          <p className="text-[13px] mb-5 font-medium" style={{ color: 'rgba(100,60,90,0.8)', fontFamily: "'Inter', system-ui, sans-serif" }}>
            {fp.headerInvitationText || 'cordially invite you to celebrate their wedding'}
          </p>
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className="h-px flex-1 max-w-[40px]" style={{ backgroundColor: 'rgba(180,140,170,0.25)' }} />
            <div className="h-1 w-1 rounded-full" style={{ backgroundColor: 'rgba(212,131,154,0.5)' }} />
            <div className="h-px flex-1 max-w-[40px]" style={{ backgroundColor: 'rgba(180,140,170,0.25)' }} />
          </div>
          <div className="flex flex-col items-center gap-3 text-[12px] sm:text-[12.5px] font-normal" style={{ color: 'rgba(80,50,75,0.8)' }}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-1.5 sm:gap-5">
              {eventDate && (
                <span className="flex items-center gap-1.5 font-medium">
                  <Calendar className="h-3 w-3 flex-shrink-0" style={{ color: 'rgba(140,90,130,0.7)' }} />
                  {format(eventDate, "MMMM d, yyyy")}
                </span>
              )}
              {eventInfo.venue && (
                <>
                  <span className="hidden sm:inline" style={{ color: 'rgba(180,140,170,0.4)' }}>|</span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <MapPin className="h-3 w-3 flex-shrink-0" style={{ color: 'rgba(140,90,130,0.7)' }} />
                    {eventInfo.venue}
                  </span>
                </>
              )}
            </div>
            {functions.some(fn => fDetails[fn]?.date || fDetails[fn]?.time) && (
              <div className="mt-2 w-full space-y-2">
                {functions.map((fn, idx) => {
                  const d = fDetails[fn];
                  if (!d?.date && !d?.time && !d?.venue) return null;
                  return (
                    <div key={idx} className="flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-2 text-[11px] font-normal" style={{ color: 'rgba(80,50,75,0.75)' }}>
                      <span className="font-semibold" style={{ color: 'rgba(60,30,55,0.9)' }}>{fn}</span>
                      <span className="flex items-center gap-1 flex-wrap justify-center">
                        {d.date && <span>{format(parseISO(d.date), 'MMM d, yyyy')}</span>}
                        {d.time && <span>· {d.time}</span>}
                      </span>
                      {d.venue && <span className="text-[10px] sm:text-[11px] text-center">· {d.venue}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }, [displayTitle, eventDate, eventInfo?.venue, eventInfo?.rsvpSettings, eventInfo?.rsvpFunctions]);

  const pageBackground = {
    background: 'linear-gradient(145deg, #f5eaf1 0%, #f0e2ec 15%, #ecdaeb 30%, #f3e5ef 50%, #eddfe9 70%, #f1e7f0 85%, #eeddea 100%)',
    position: 'relative' as const,
  };

  const DecorativeBackground = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Large rose cluster - top right */}
      <div className="absolute -top-6 -right-6 w-80 h-80 sm:w-[420px] sm:h-[420px] opacity-[0.22]" style={{ transform: 'rotate(10deg)' }}>
        <svg viewBox="0 0 300 300" fill="none">
          {/* Main rose */}
          <ellipse cx="200" cy="80" rx="28" ry="34" fill="#d4839a" opacity="0.5" transform="rotate(-12 200 80)" />
          <ellipse cx="193" cy="72" rx="22" ry="28" fill="#e8a0b5" opacity="0.55" transform="rotate(8 193 72)" />
          <ellipse cx="202" cy="68" rx="16" ry="22" fill="#edb5c7" opacity="0.6" transform="rotate(-18 202 68)" />
          <ellipse cx="196" cy="66" rx="10" ry="14" fill="#f2c8d6" opacity="0.65" transform="rotate(5 196 66)" />
          <circle cx="198" cy="70" r="6" fill="#d4839a" opacity="0.35" />
          {/* Second rose */}
          <ellipse cx="155" cy="55" rx="20" ry="25" fill="#e0b0c0" opacity="0.4" transform="rotate(15 155 55)" />
          <ellipse cx="150" cy="50" rx="15" ry="19" fill="#ecc0d0" opacity="0.5" transform="rotate(-8 150 50)" />
          <ellipse cx="154" cy="48" rx="9" ry="12" fill="#f0d0dd" opacity="0.55" transform="rotate(12 154 48)" />
          <circle cx="152" cy="50" r="5" fill="#e0b0c0" opacity="0.3" />
          {/* Third rose bud */}
          <ellipse cx="230" cy="120" rx="14" ry="18" fill="#d4839a" opacity="0.35" transform="rotate(-25 230 120)" />
          <ellipse cx="227" cy="116" rx="9" ry="13" fill="#e8a0b5" opacity="0.4" transform="rotate(10 227 116)" />
          <circle cx="228" cy="118" r="4" fill="#d4839a" opacity="0.25" />
          {/* Stems */}
          <path d="M190 100 Q175 130 185 170" stroke="#6b8e5a" strokeWidth="2" fill="none" />
          <path d="M148 70 Q140 100 155 140" stroke="#6b8e5a" strokeWidth="1.8" fill="none" />
          <path d="M225 135 Q220 155 228 180" stroke="#6b8e5a" strokeWidth="1.5" fill="none" />
          {/* Leaves */}
          <path d="M185 120 Q168 115 158 130 Q170 128 185 120Z" fill="#7a9e6b" opacity="0.2" />
          <path d="M188 140 Q200 135 210 148 Q198 145 188 140Z" fill="#7a9e6b" opacity="0.18" />
          <path d="M150 90 Q135 88 128 100 Q140 95 150 90Z" fill="#7a9e6b" opacity="0.18" />
          <path d="M155 120 Q165 112 175 122 Q163 118 155 120Z" fill="#7a9e6b" opacity="0.15" />
          <path d="M222 155 Q210 150 205 162 Q215 155 222 155Z" fill="#7a9e6b" opacity="0.15" />
          {/* Lavender sprigs */}
          <path d="M170 65 Q158 40 150 10" stroke="#9b8ec4" strokeWidth="1" fill="none" />
          <circle cx="150" cy="12" r="3.5" fill="#b0a3d4" opacity="0.55" />
          <circle cx="153" cy="20" r="3" fill="#b0a3d4" opacity="0.5" />
          <circle cx="156" cy="28" r="3" fill="#b0a3d4" opacity="0.45" />
          <circle cx="159" cy="36" r="2.5" fill="#b0a3d4" opacity="0.4" />
          <circle cx="162" cy="44" r="2.2" fill="#b0a3d4" opacity="0.35" />
          <circle cx="165" cy="52" r="1.8" fill="#b0a3d4" opacity="0.3" />
          <path d="M180 60 Q172 35 168 8" stroke="#9b8ec4" strokeWidth="0.8" fill="none" />
          <circle cx="168" cy="10" r="2.8" fill="#c4b8de" opacity="0.5" />
          <circle cx="170" cy="18" r="2.5" fill="#c4b8de" opacity="0.45" />
          <circle cx="172" cy="26" r="2.2" fill="#c4b8de" opacity="0.4" />
          <circle cx="174" cy="34" r="2" fill="#c4b8de" opacity="0.35" />
          <circle cx="176" cy="42" r="1.8" fill="#c4b8de" opacity="0.3" />
          {/* Baby's breath dots */}
          <circle cx="140" cy="35" r="1.5" fill="#fff" opacity="0.5" />
          <circle cx="135" cy="42" r="1.2" fill="#fff" opacity="0.4" />
          <circle cx="145" cy="40" r="1" fill="#fff" opacity="0.45" />
          <circle cx="210" cy="95" r="1.5" fill="#fff" opacity="0.4" />
          <circle cx="215" cy="102" r="1.2" fill="#fff" opacity="0.35" />
          <circle cx="240" cy="108" r="1" fill="#fff" opacity="0.3" />
          {/* Twine bow */}
          <path d="M180 170 Q175 185 185 200 Q180 215 190 230" stroke="#c4a87a" strokeWidth="1.2" fill="none" />
          <path d="M155 140 Q150 155 160 170 Q155 180 162 195" stroke="#c4a87a" strokeWidth="1" fill="none" />
        </svg>
      </div>
      {/* Flower cluster - bottom left */}
      <div className="absolute -bottom-4 -left-10 w-72 h-72 sm:w-96 sm:h-96 opacity-[0.18]" style={{ transform: 'rotate(-15deg)' }}>
        <svg viewBox="0 0 300 300" fill="none">
          {/* Rose */}
          <ellipse cx="120" cy="140" rx="22" ry="28" fill="#d4839a" opacity="0.45" transform="rotate(12 120 140)" />
          <ellipse cx="115" cy="135" rx="16" ry="22" fill="#e8a0b5" opacity="0.5" transform="rotate(-6 115 135)" />
          <ellipse cx="118" cy="132" rx="10" ry="15" fill="#edb5c7" opacity="0.55" transform="rotate(10 118 132)" />
          <circle cx="117" cy="134" r="5" fill="#d4839a" opacity="0.3" />
          {/* Second flower - peony style */}
          <ellipse cx="170" cy="160" rx="18" ry="22" fill="#e0b0c0" opacity="0.35" transform="rotate(-20 170 160)" />
          <ellipse cx="166" cy="156" rx="13" ry="17" fill="#ecc0d0" opacity="0.4" transform="rotate(8 166 156)" />
          <circle cx="168" cy="158" r="4.5" fill="#e0b0c0" opacity="0.25" />
          {/* Small bud */}
          <ellipse cx="85" cy="170" rx="10" ry="14" fill="#d4839a" opacity="0.3" transform="rotate(20 85 170)" />
          <ellipse cx="83" cy="167" rx="6" ry="10" fill="#e8a0b5" opacity="0.35" />
          {/* Stems */}
          <path d="M115 165 Q110 200 118 240" stroke="#6b8e5a" strokeWidth="1.8" fill="none" />
          <path d="M165 178 Q160 210 168 245" stroke="#6b8e5a" strokeWidth="1.5" fill="none" />
          <path d="M82 182 Q78 210 85 240" stroke="#6b8e5a" strokeWidth="1.2" fill="none" />
          {/* Leaves */}
          <path d="M112 185 Q95 180 88 195 Q100 190 112 185Z" fill="#7a9e6b" opacity="0.2" />
          <path d="M118 205 Q132 198 138 212 Q128 208 118 205Z" fill="#7a9e6b" opacity="0.18" />
          <path d="M162 195 Q148 192 142 205 Q152 198 162 195Z" fill="#7a9e6b" opacity="0.17" />
          <path d="M80 200 Q68 198 62 210 Q72 205 80 200Z" fill="#7a9e6b" opacity="0.15" />
          {/* Lavender */}
          <path d="M100 140 Q90 115 85 85" stroke="#9b8ec4" strokeWidth="0.8" fill="none" />
          <circle cx="85" cy="88" r="2.8" fill="#b0a3d4" opacity="0.45" />
          <circle cx="87" cy="96" r="2.5" fill="#b0a3d4" opacity="0.4" />
          <circle cx="89" cy="104" r="2.2" fill="#b0a3d4" opacity="0.35" />
          <circle cx="92" cy="112" r="2" fill="#b0a3d4" opacity="0.3" />
          <circle cx="95" cy="120" r="1.8" fill="#b0a3d4" opacity="0.25" />
          {/* Baby's breath */}
          <circle cx="145" cy="145" r="1.5" fill="#fff" opacity="0.45" />
          <circle cx="150" cy="150" r="1.2" fill="#fff" opacity="0.4" />
          <circle cx="95" cy="155" r="1.3" fill="#fff" opacity="0.38" />
          <circle cx="100" cy="162" r="1" fill="#fff" opacity="0.35" />
          <circle cx="180" cy="170" r="1.2" fill="#fff" opacity="0.35" />
        </svg>
      </div>
      {/* Mid-left small flower */}
      <div className="absolute top-[30%] -left-4 w-40 h-40 opacity-[0.14]" style={{ transform: 'rotate(25deg)' }}>
        <svg viewBox="0 0 100 100" fill="none">
          <ellipse cx="50" cy="40" rx="12" ry="16" fill="#e8a0b5" opacity="0.45" transform="rotate(-10 50 40)" />
          <ellipse cx="47" cy="37" rx="8" ry="12" fill="#edb5c7" opacity="0.5" />
          <circle cx="48" cy="38" r="3.5" fill="#d4839a" opacity="0.3" />
          <path d="M48 55 Q45 72 50 90" stroke="#6b8e5a" strokeWidth="1" fill="none" />
          <path d="M45 65 Q36 62 32 72 Q40 67 45 65Z" fill="#7a9e6b" opacity="0.18" />
          <path d="M50 75 Q58 70 62 78 Q55 75 50 75Z" fill="#7a9e6b" opacity="0.15" />
        </svg>
      </div>
      {/* Mid-right small flower */}
      <div className="absolute top-[55%] -right-2 w-36 h-36 opacity-[0.13]" style={{ transform: 'rotate(-30deg)' }}>
        <svg viewBox="0 0 100 100" fill="none">
          <ellipse cx="50" cy="35" rx="11" ry="15" fill="#d4839a" opacity="0.4" transform="rotate(15 50 35)" />
          <ellipse cx="48" cy="32" rx="7" ry="11" fill="#e8a0b5" opacity="0.45" />
          <circle cx="49" cy="34" r="3" fill="#d4839a" opacity="0.25" />
          <path d="M49 50 Q52 68 48 88" stroke="#6b8e5a" strokeWidth="0.8" fill="none" />
          <path d="M52 60 Q60 56 64 65 Q57 62 52 60Z" fill="#7a9e6b" opacity="0.15" />
        </svg>
      </div>
      {/* Scattered petals - many more */}
      <div className="absolute top-[12%] left-[20%] w-7 h-7 opacity-[0.18] rotate-[40deg]">
        <svg viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="9" ry="5" fill="#e8a0b5" /></svg>
      </div>
      <div className="absolute top-[8%] left-[45%] w-5 h-5 opacity-[0.12] rotate-[110deg]">
        <svg viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="8" ry="4.5" fill="#d4839a" /></svg>
      </div>
      <div className="absolute top-[25%] right-[25%] w-4 h-4 opacity-[0.10] rotate-[160deg]">
        <svg viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="7" ry="4" fill="#edb5c7" /></svg>
      </div>
      <div className="absolute top-[38%] left-[35%] w-5 h-5 opacity-[0.10] rotate-[85deg]">
        <svg viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="8" ry="4" fill="#c4b8de" /></svg>
      </div>
      <div className="absolute top-[48%] right-[18%] w-6 h-6 opacity-[0.14] rotate-[55deg]">
        <svg viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="8" ry="5" fill="#e8a0b5" /></svg>
      </div>
      <div className="absolute top-[60%] left-[12%] w-5 h-5 opacity-[0.12] rotate-[135deg]">
        <svg viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="7" ry="4.5" fill="#d4839a" /></svg>
      </div>
      <div className="absolute top-[72%] left-[42%] w-4 h-4 opacity-[0.09] rotate-[200deg]">
        <svg viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="7" ry="3.5" fill="#edb5c7" /></svg>
      </div>
      <div className="absolute top-[78%] right-[15%] w-6 h-6 opacity-[0.13] rotate-[25deg]">
        <svg viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="8" ry="5" fill="#e0b0c0" /></svg>
      </div>
      <div className="absolute top-[85%] left-[25%] w-3 h-3 opacity-[0.11] rotate-[280deg]">
        <svg viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="6" ry="3.5" fill="#c4b8de" /></svg>
      </div>
      <div className="absolute top-[18%] left-[8%] w-4 h-4 opacity-[0.11] rotate-[65deg]">
        <svg viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="7" ry="4" fill="#e8a0b5" /></svg>
      </div>
      <div className="absolute top-[52%] left-[55%] w-3 h-3 opacity-[0.08] rotate-[310deg]">
        <svg viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="6" ry="3" fill="#d4839a" /></svg>
      </div>
      <div className="absolute top-[90%] right-[40%] w-5 h-5 opacity-[0.10] rotate-[150deg]">
        <svg viewBox="0 0 20 20"><ellipse cx="10" cy="10" rx="8" ry="4" fill="#e0b0c0" /></svg>
      </div>
      {/* Soft radial glows */}
      <div className="absolute inset-0" style={{
        backgroundImage: 'radial-gradient(circle at 82% 12%, rgba(212,131,154,0.10) 0%, transparent 35%), radial-gradient(circle at 12% 82%, rgba(212,131,154,0.08) 0%, transparent 35%), radial-gradient(circle at 50% 50%, rgba(232,160,181,0.05) 0%, transparent 45%), radial-gradient(circle at 25% 18%, rgba(176,163,212,0.06) 0%, transparent 30%), radial-gradient(circle at 75% 75%, rgba(155,142,196,0.05) 0%, transparent 30%), radial-gradient(circle at 40% 70%, rgba(237,181,199,0.04) 0%, transparent 35%)',
      }} />
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={pageBackground}>
        <DecorativeBackground />
        <Card className="w-full max-w-md border-0 relative z-10" style={{ borderRadius: '14px', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: OAK_GREEN }} />
            <span className="ml-3 text-gray-600">Loading invitation...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={pageBackground}>
        <DecorativeBackground />
        <Card className="w-full max-w-md border-0 relative z-10" style={{ borderRadius: '14px', boxShadow: '0 1px 8px rgba(0,0,0,0.05)' }}>
          <CardHeader className="text-center">
            <X className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-red-600">Invalid Link</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!eventInfo) return null;

  if (step === "submitted") {
    return (
      <div className="min-h-screen py-6 sm:py-10 px-4" style={pageBackground}>
        <DecorativeBackground />
        <div className="max-w-lg mx-auto space-y-6 relative z-10">
          {eventHeader}
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150 text-center" style={{ borderRadius: '14px', backgroundColor: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', padding: '32px 24px' }}>
            <div className="h-12 w-12 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: '#f0f5eb' }}>
              <Check className="h-6 w-6" style={{ color: OAK_GREEN }} />
            </div>
            <h3 className="text-xl font-semibold mb-1.5" style={{ color: OAK_GREEN }}>Thank You, {selectedGuest?.name}!</h3>
            <p className="text-[14px] leading-relaxed" style={{ color: '#999' }}>
              {attendance === "yes" 
                ? (fp.thankYouAttending || "We look forward to celebrating with you!") 
                : attendance === "no"
                ? (fp.thankYouNotAttending || "We're sorry you won't be able to make it.")
                : "We hope you can join us!"}
            </p>
            <Button
              onClick={handleAnotherGuest}
              variant="outline"
              className="mt-6 transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
              style={{ borderColor: OAK_GREEN, color: OAK_GREEN, borderRadius: '10px', height: '44px', paddingLeft: '20px', paddingRight: '20px', fontSize: '14px' }}
              data-testid="button-another-guest"
            >
              <Users className="h-4 w-4 mr-1.5" />
              RSVP for Another Guest
            </Button>
          </div>
          <p className="text-center text-xs tracking-wide" style={{ color: '#bbb' }}>
            Powered by <span style={{ color: '#999' }}>Oakstreet Events</span>
          </p>
        </div>
      </div>
    );
  }

  if (step === "search") {
    return (
      <div className="min-h-screen py-6 sm:py-10 px-4" style={pageBackground}>
        <DecorativeBackground />
        <div className="max-w-lg mx-auto space-y-6 relative z-10">
          {eventHeader}

          <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150" style={{ borderRadius: '14px', backgroundColor: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div className="px-4 sm:px-8 pt-5 sm:pt-6 pb-1">
              <h3 className="text-lg font-semibold" style={{ color: '#222', letterSpacing: '-0.01em' }}>Confirm Your Presence</h3>
              <p className="text-[13px] mt-1 leading-relaxed" style={{ color: '#999' }}>{fp.searchPrompt || 'Search for your name to find your invitation.'}</p>
            </div>
            <div className="px-4 sm:px-8 pb-6 pt-4 space-y-5">
              <div className="flex gap-2 items-center">
                <Input
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  placeholder="Enter your name..."
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="flex-1 min-w-0"
                  style={{ height: '48px', borderRadius: '10px', border: '1.5px solid #ddd', fontSize: '14px', transition: 'border-color 0.2s, box-shadow 0.2s' }}
                  onFocus={(e) => { e.target.style.borderColor = OAK_GREEN; e.target.style.boxShadow = `0 0 0 3px rgba(75,124,41,0.1)`; }}
                  onBlur={(e) => { e.target.style.borderColor = '#ddd'; e.target.style.boxShadow = 'none'; }}
                  data-testid="input-search-name"
                />
                <Button
                  onClick={handleSearch}
                  disabled={searching || searchName.trim().length < 1}
                  className="text-white font-medium transition-all duration-200 hover:brightness-110 active:scale-[0.97] flex-shrink-0"
                  style={{ backgroundColor: OAK_GREEN, height: '48px', borderRadius: '10px', paddingLeft: '14px', paddingRight: '14px', fontSize: '14px' }}
                  data-testid="button-search"
                >
                  {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  <span className="hidden sm:inline ml-1.5">{searching ? 'Searching...' : 'Search'}</span>
                </Button>
              </div>

              {searchDone && searchResults.length > 0 && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <p className="text-sm font-medium" style={{ color: '#666' }}>{searchResults.length} invitation{searchResults.length > 1 ? 's' : ''} found</p>
                  {searchResults.map((guest) => (
                    <button
                      key={guest.id}
                      onClick={() => handleSelectGuest(guest)}
                      className="w-full text-left p-3.5 flex items-center gap-3 transition-all duration-200 active:scale-[0.99]"
                      style={{ borderRadius: '10px', border: '1.5px solid #e8e8e8', backgroundColor: 'white' }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = OAK_GREEN; e.currentTarget.style.backgroundColor = '#fafdf7'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#e8e8e8'; e.currentTarget.style.backgroundColor = 'white'; }}
                      data-testid={`button-select-guest-${guest.id}`}
                    >
                      <div className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0" style={{ backgroundColor: OAK_GREEN }}>
                        {guest.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[14px]" style={{ color: '#222' }}>{guest.name}</p>
                        <p className="text-[12px] mt-0.5" style={{ color: '#aaa' }}>Tap to confirm</p>
                      </div>
                      <ArrowLeft className="h-3.5 w-3.5 rotate-180 flex-shrink-0" style={{ color: '#ccc' }} />
                    </button>
                  ))}
                </div>
              )}

              {searchDone && searchResults.length === 0 && !selfRegistering && (
                <div className="text-center py-6 animate-in fade-in duration-300">
                  <div className="h-12 w-12 rounded-full mx-auto mb-3 flex items-center justify-center" style={{ backgroundColor: '#f0f5eb' }}>
                    <User className="h-5 w-5" style={{ color: OAK_GREEN }} />
                  </div>
                  <p className="font-semibold text-sm" style={{ color: '#333' }}>Name not found</p>
                  <p className="text-[13px] mt-1.5 mb-5 leading-relaxed max-w-[260px] mx-auto" style={{ color: '#999' }}>Check spelling or register below to RSVP.</p>
                  <Button
                    onClick={() => {
                      setSelfRegistering(true);
                      setSelfRegName(searchName.trim());
                    }}
                    className="text-white px-6 transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                    style={{ backgroundColor: OAK_GREEN, height: '44px', borderRadius: '10px', fontSize: '14px' }}
                    data-testid="btn-self-register"
                  >
                    <User className="h-4 w-4 mr-1.5" />
                    Register & RSVP
                  </Button>
                </div>
              )}

              {selfRegistering && (
                <div className="space-y-4 pt-4 animate-in fade-in slide-in-from-bottom-2 duration-300" style={{ borderTop: '1px solid #f0f0f0' }}>
                  <div className="p-3.5" style={{ backgroundColor: '#f7faf4', borderRadius: '10px' }}>
                    <p className="text-sm font-semibold" style={{ color: OAK_GREEN_DARK }}>Quick Registration</p>
                    <p className="text-[12px] mt-0.5" style={{ color: '#888' }}>Enter your details to confirm your presence.</p>
                  </div>
                  <div>
                    <Label className="text-[13px] font-medium" style={{ color: '#555' }}>Full Name</Label>
                    <Input
                      value={selfRegName}
                      onChange={(e) => setSelfRegName(e.target.value)}
                      placeholder="Enter your full name"
                      className="mt-1"
                      style={{ height: '46px', borderRadius: '10px', fontSize: '14px' }}
                      data-testid="input-self-reg-name"
                    />
                  </div>
                  <div>
                    <Label className="text-[13px] font-medium" style={{ color: '#555' }}>Phone Number</Label>
                    <Input
                      value={selfRegPhone}
                      onChange={(e) => setSelfRegPhone(e.target.value)}
                      placeholder="Enter your phone number"
                      className="mt-1"
                      style={{ height: '46px', borderRadius: '10px', fontSize: '14px' }}
                      data-testid="input-self-reg-phone"
                    />
                  </div>
                  <Button
                    onClick={async () => {
                      if (selfRegName.trim().length < 2) {
                        toast({ title: "Please enter your full name", variant: "destructive" });
                        return;
                      }
                      if (selfRegPhone.trim().length < 5) {
                        toast({ title: "Please enter a valid phone number", variant: "destructive" });
                        return;
                      }
                      try {
                        const res = await fetch(`/api/rsvp/event/${code}/self-register`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ name: selfRegName.trim(), phone: selfRegPhone.trim() }),
                        });
                        if (!res.ok) {
                          const data = await res.json();
                          throw new Error(data.error || "Failed to register");
                        }
                        const guest = await res.json();
                        setSelectedGuest(guest);
                        setStep("form");
                        toast({ title: "Welcome!", description: "You've been registered. Please fill in your RSVP." });
                      } catch (err: any) {
                        toast({ title: err.message || "Registration failed", variant: "destructive" });
                      }
                    }}
                    className="w-full text-white font-medium transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                    style={{ backgroundColor: OAK_GREEN, height: '50px', borderRadius: '10px', fontSize: '14px' }}
                    disabled={selfRegName.trim().length < 2 || selfRegPhone.trim().length < 5}
                    data-testid="btn-submit-self-reg"
                  >
                    Continue to RSVP
                  </Button>
                </div>
              )}
            </div>
          </div>

          <p className="text-center text-xs tracking-wide" style={{ color: '#bbb' }}>
            Powered by <span style={{ color: '#999' }}>Oakstreet Events</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-6 sm:py-10 px-4" style={pageBackground}>
      <DecorativeBackground />
      <div className="max-w-lg mx-auto space-y-6 relative z-10">
        {eventHeader}

        <div className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150" style={{ borderRadius: '14px', backgroundColor: 'white', boxShadow: '0 1px 8px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
          <div className="px-4 sm:px-8 pt-5 sm:pt-6 pb-1">
            <div className="flex items-center gap-3 mb-1">
              <button
                onClick={() => setStep("search")}
                className="h-8 w-8 flex items-center justify-center rounded-full transition-colors duration-200 hover:bg-gray-100 flex-shrink-0"
                data-testid="button-back-search"
              >
                <ArrowLeft className="h-4 w-4" style={{ color: '#888' }} />
              </button>
              <div>
                <h3 className="text-base font-semibold" style={{ color: '#222' }}>{selectedGuest?.name}</h3>
                <p className="text-[13px]" style={{ color: '#999' }}>{fp.confirmationPrompt || 'Please confirm your attendance'}</p>
              </div>
            </div>
          </div>
          <div className="px-4 sm:px-8 pb-7 pt-4 space-y-5">

            <RadioGroup
              value={attendance}
              onValueChange={setAttendance}
              className="grid grid-cols-3 gap-3"
              data-testid="radio-attendance"
            >
              <div>
                <RadioGroupItem value="yes" id="yes" className="peer sr-only" data-testid="radio-yes" />
                <Label
                  htmlFor="yes"
                  className="flex flex-col items-center justify-center p-2.5 sm:p-3.5 min-h-[48px] cursor-pointer transition-all duration-200"
                  style={{ borderRadius: '10px', border: '1.5px solid', borderColor: attendance === 'yes' ? OAK_GREEN : '#e0e0e0', backgroundColor: attendance === 'yes' ? '#f0f5eb' : 'white' }}
                >
                  <Check className="h-5 w-5 sm:h-6 sm:w-6 mb-1.5" style={{ color: OAK_GREEN }} />
                  <span className="font-medium text-[11px] sm:text-[13px]">Attending</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="no" id="no" className="peer sr-only" data-testid="radio-no" />
                <Label
                  htmlFor="no"
                  className="flex flex-col items-center justify-center p-2.5 sm:p-3.5 min-h-[48px] cursor-pointer transition-all duration-200"
                  style={{ borderRadius: '10px', border: '1.5px solid', borderColor: attendance === 'no' ? '#dc2626' : '#e0e0e0', backgroundColor: attendance === 'no' ? '#fef2f2' : 'white' }}
                >
                  <X className="h-5 w-5 sm:h-6 sm:w-6 mb-1.5 text-red-400" />
                  <span className="font-medium text-[11px] sm:text-[13px]">Regret</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem value="maybe" id="maybe" className="peer sr-only" data-testid="radio-maybe" />
                <Label
                  htmlFor="maybe"
                  className="flex flex-col items-center justify-center p-2.5 sm:p-3.5 min-h-[48px] cursor-pointer transition-all duration-200"
                  style={{ borderRadius: '10px', border: '1.5px solid', borderColor: attendance === 'maybe' ? '#6b7280' : '#e0e0e0', backgroundColor: attendance === 'maybe' ? '#f9fafb' : 'white' }}
                >
                  <HelpCircle className="h-5 w-5 sm:h-6 sm:w-6 mb-1.5 text-gray-300" />
                  <span className="font-medium text-[11px] sm:text-[13px]">Maybe</span>
                </Label>
              </div>
            </RadioGroup>

            {attendance === "yes" && selectedGuest && (
              <div className="space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                {fp.showEventsSection !== false && (
                <div className="p-4" style={{ backgroundColor: '#f7faf4', borderRadius: '10px' }}>
                  <Label className="flex items-center gap-2 mb-3 font-medium text-[13px]" style={{ color: OAK_GREEN_DARK }}>
                    <Calendar className="h-3.5 w-3.5" />
                    Which events will you attend?
                  </Label>
                  <div className="space-y-3">
                    {(eventInfo?.rsvpFunctions || ['Wedding', 'Engagement / Reception']).map((fn, idx) => {
                      const fd = functionDetails[fn];
                      return (
                      <div key={idx} className="flex items-start space-x-3">
                        <Checkbox
                          id={`attendFn-${idx}`}
                          checked={selectedFunctions.includes(fn)}
                          onCheckedChange={(checked) => {
                            setSelectedFunctions(prev =>
                              checked ? [...prev, fn] : prev.filter(f => f !== fn)
                            );
                          }}
                          className="mt-0.5"
                          data-testid={`checkbox-function-${idx}`}
                        />
                        <div>
                          <Label htmlFor={`attendFn-${idx}`} className="cursor-pointer text-[14px] font-medium">{fn}</Label>
                          {(fd?.date || fd?.time || fd?.venue) && (
                            <p className="text-[11px] mt-0.5" style={{ color: '#999' }}>
                              {fd.date && format(parseISO(fd.date), 'MMM d, yyyy')}
                              {fd.time && ` · ${fd.time}`}
                              {fd.venue && ` · ${fd.venue}`}
                            </p>
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
                )}

                {fp.showGuestCount !== false && (
                <div className="space-y-3">
                  <Label className="flex items-center gap-2 text-[13px] font-medium" style={{ color: '#444' }}><Users className="h-3.5 w-3.5" />Number of Guests</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3.5" style={{ borderRadius: '10px', border: '1.5px solid #e0e0e0' }}>
                      <Label className="text-[11px] font-medium mb-1.5 block" style={{ color: '#999' }}>Adults</Label>
                      <div className="flex items-center gap-2 justify-center">
                        <Button type="button" variant="outline" size="icon" className="h-9 w-9 sm:h-8 sm:w-8 rounded-full" onClick={() => setAdultCount(Math.max(1, adultCount - 1))} disabled={adultCount <= 1} data-testid="btn-dec-adults">-</Button>
                        <span className="text-xl font-semibold w-7 text-center" data-testid="text-adult-count">{adultCount}</span>
                        <Button type="button" variant="outline" size="icon" className="h-9 w-9 sm:h-8 sm:w-8 rounded-full" onClick={() => setAdultCount(adultCount + 1)} data-testid="btn-inc-adults">+</Button>
                      </div>
                    </div>
                    <div className="p-3.5" style={{ borderRadius: '10px', border: '1.5px solid #e0e0e0' }}>
                      <Label className="text-[11px] font-medium mb-1.5 block" style={{ color: '#999' }}>Children (below 12)</Label>
                      <div className="flex items-center gap-2 justify-center">
                        <Button type="button" variant="outline" size="icon" className="h-9 w-9 sm:h-8 sm:w-8 rounded-full" onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))} disabled={childrenCount <= 0} data-testid="btn-dec-children">-</Button>
                        <span className="text-xl font-semibold w-7 text-center" data-testid="text-children-count">{childrenCount}</span>
                        <Button type="button" variant="outline" size="icon" className="h-9 w-9 sm:h-8 sm:w-8 rounded-full" onClick={() => setChildrenCount(childrenCount + 1)} data-testid="btn-inc-children">+</Button>
                      </div>
                    </div>
                  </div>
                  <p className="text-[11px] text-center" style={{ color: '#bbb' }}>Total: {adultCount + childrenCount} guest{adultCount + childrenCount !== 1 ? 's' : ''}</p>
                </div>
                )}

                {fp.showMealPreference !== false && (
                <div>
                  <Label className="flex items-center gap-2 mb-2.5 text-[13px] font-medium" style={{ color: '#444' }}><UtensilsCrossed className="h-3.5 w-3.5" />Meal Preference</Label>
                  <RadioGroup value={mealPreference} onValueChange={setMealPreference} className="grid grid-cols-2 gap-3" data-testid="radio-meal">
                    <div>
                      <RadioGroupItem value="vegetarian" id="veg" className="peer sr-only" data-testid="radio-veg" />
                      <Label htmlFor="veg" className="flex items-center justify-center p-3 min-h-[44px] cursor-pointer transition-all duration-200" style={{ borderRadius: '10px', border: '1.5px solid', borderColor: mealPreference === 'vegetarian' ? OAK_GREEN : '#e0e0e0', backgroundColor: mealPreference === 'vegetarian' ? '#f0f5eb' : 'white' }}>
                        <span className="h-2 w-2 rounded-full mr-2" style={{ backgroundColor: OAK_GREEN }}></span><span className="text-[13px] font-medium">Vegetarian</span>
                      </Label>
                    </div>
                    <div>
                      <RadioGroupItem value="non_vegetarian" id="nonveg" className="peer sr-only" data-testid="radio-nonveg" />
                      <Label htmlFor="nonveg" className="flex items-center justify-center p-3 min-h-[44px] cursor-pointer transition-all duration-200" style={{ borderRadius: '10px', border: '1.5px solid', borderColor: mealPreference === 'non_vegetarian' ? '#dc2626' : '#e0e0e0', backgroundColor: mealPreference === 'non_vegetarian' ? '#fef2f2' : 'white' }}>
                        <span className="h-2 w-2 rounded-full bg-red-400 mr-2"></span><span className="text-[13px] font-medium">Non-Vegetarian</span>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
                )}

                {fp.showDietaryRestrictions && (
                <div>
                  <Label className="flex items-center gap-2 mb-2 text-[13px] font-medium" style={{ color: '#444' }}>
                    <UtensilsCrossed className="h-3.5 w-3.5" />Dietary Restrictions / Allergies
                  </Label>
                  <Input
                    value={dietaryRestrictions}
                    onChange={(e) => setDietaryRestrictions(e.target.value)}
                    placeholder="e.g. Gluten-free, Nut allergy, Halal..."
                    style={{ borderRadius: '10px', height: '44px', fontSize: '14px' }}
                    data-testid="input-dietary-restrictions"
                  />
                </div>
                )}

                {fp.showWhatsAppField && (
                <div>
                  <Label className="flex items-center gap-2 mb-2 text-[13px] font-medium" style={{ color: '#444' }}>
                    <MessageSquare className="h-3.5 w-3.5" />WhatsApp Number
                  </Label>
                  <Input
                    value={whatsAppNumber}
                    onChange={(e) => setWhatsAppNumber(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    style={{ borderRadius: '10px', height: '44px', fontSize: '14px' }}
                    data-testid="input-whatsapp-number"
                  />
                  <p className="text-[11px] mt-1" style={{ color: '#bbb' }}>We'll send event updates via WhatsApp</p>
                </div>
                )}

                {fp.showDressCode && fp.dressCodeText && (
                <div className="p-3.5 flex items-start gap-3" style={{ borderRadius: '10px', backgroundColor: '#faf8f2', border: '1px solid #f0ead8' }}>
                  <span className="text-lg">👔</span>
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: '#555' }}>Dress Code</p>
                    <p className="text-[13px] mt-0.5" style={{ color: '#888' }}>{fp.dressCodeText}</p>
                  </div>
                </div>
                )}

                {showSection.secondaryContact && (
                  <div className="pt-2" style={{ borderTop: '1px solid #f0f0f0' }}>
                    <h3 className="text-[14px] font-semibold mb-1" style={{ color: OAK_GREEN_DARK }}>
                      <span className="flex items-center gap-2"><UserPlus className="h-3.5 w-3.5" />Alternate Contact</span>
                    </h3>
                    <p className="text-[13px] mb-4" style={{ color: '#999' }}>Provide a secondary contact if available.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {!fp.hideAlternateContactName && (
                      <div><Label className="text-sm" style={{ color: '#666' }}>Name</Label><Input value={alternateContactName} onChange={(e) => setAlternateContactName(e.target.value)} placeholder="Alternate contact name" style={{ borderRadius: '12px', height: '44px' }} data-testid="input-alt-contact-name" /></div>
                      )}
                      <div><Label className="text-sm" style={{ color: '#666' }}>Phone</Label><Input value={alternateContactPhone} onChange={(e) => setAlternateContactPhone(e.target.value)} placeholder="e.g. +91 98765 43210" style={{ borderRadius: '12px', height: '44px' }} data-testid="input-alt-contact-phone" /></div>
                    </div>
                  </div>
                )}

                {(showSection.pickup || showSection.accommodation || showSection.transport || showSection.tour || showSection.departure || showSection.hotelAllocation) && (
                <div className="pt-2" style={{ borderTop: '1px solid #f0f0f0' }}>
                  <h3 className="text-[14px] font-semibold mb-1" style={{ color: OAK_GREEN_DARK }}>Travel & Logistics</h3>
                  <p className="text-[13px] mb-4" style={{ color: '#999' }}>Help us plan your comfortable stay.</p>

                  <div className="space-y-3">
                    {showSection.pickup && (
                    <div className="p-4" style={{ borderRadius: '10px', border: '1.5px solid #e0e0e0' }}>
                      <div className="flex items-center space-x-3 mb-2">
                        <Checkbox id="needsPickup" checked={needsAirportPickup} onCheckedChange={(c) => setNeedsAirportPickup(c as boolean)} data-testid="checkbox-pickup" />
                        <Label htmlFor="needsPickup" className="cursor-pointer flex items-center gap-2 font-medium text-[14px]">
                          <Plane className="h-3.5 w-3.5" style={{ color: OAK_GREEN }} />Airport / Station Pickup
                        </Label>
                      </div>
                      {needsAirportPickup && (
                        <div className="ml-0 sm:ml-7 mt-2 space-y-3 animate-in fade-in duration-200">
                          <div><Label className="text-sm" style={{ color: '#666' }}>Flight / Train Number</Label><Input value={pickupFlightTrainNo} onChange={(e) => setPickupFlightTrainNo(e.target.value)} placeholder="e.g. AI-505 or 12625" style={{ borderRadius: '12px', height: '44px' }} data-testid="input-flight" /></div>
                          <div><Label className="text-sm" style={{ color: '#666' }}>Pickup Point</Label><Input value={pickupPoint} onChange={(e) => setPickupPoint(e.target.value)} placeholder="e.g. Cochin International Airport" style={{ borderRadius: '12px', height: '44px' }} data-testid="input-pickup-point" /></div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div><Label className="text-sm" style={{ color: '#666' }}>Arrival Date</Label><Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} style={{ borderRadius: '12px', height: '44px' }} data-testid="input-pickup-date" /></div>
                            <div><Label className="text-sm" style={{ color: '#666' }}>Arrival Time</Label><Input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} style={{ borderRadius: '12px', height: '44px' }} data-testid="input-pickup-time" /></div>
                          </div>
                          {!fp.hidePickupContactPerson && (
                          <div><Label className="text-sm" style={{ color: '#666' }}>Contact Person</Label><Input value={pickupContactPerson} onChange={(e) => setPickupContactPerson(e.target.value)} placeholder="Person to contact" style={{ borderRadius: '12px', height: '44px' }} data-testid="input-pickup-contact" /></div>
                          )}
                        </div>
                      )}
                    </div>
                    )}

                    {showSection.accommodation && (
                    <div className="p-4" style={{ borderRadius: '10px', border: '1.5px solid #e0e0e0' }}>
                      <div className="flex items-center space-x-3 mb-2">
                        <Checkbox id="needsStay" checked={needsAccommodation} onCheckedChange={(c) => setNeedsAccommodation(c as boolean)} data-testid="checkbox-accommodation" />
                        <Label htmlFor="needsStay" className="cursor-pointer flex items-center gap-2 font-medium text-[14px]">
                          <Hotel className="h-3.5 w-3.5" style={{ color: OAK_GREEN }} />Accommodation
                        </Label>
                      </div>
                      {needsAccommodation && (
                        <div className="ml-0 sm:ml-7 mt-2 space-y-3 animate-in fade-in duration-200">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div><Label className="text-sm" style={{ color: '#666' }}>Check-in</Label><Input type="date" value={accommodationCheckIn} onChange={(e) => setAccommodationCheckIn(e.target.value)} style={{ borderRadius: '12px', height: '44px' }} data-testid="input-checkin" /></div>
                            <div><Label className="text-sm" style={{ color: '#666' }}>Check-out</Label><Input type="date" value={accommodationCheckOut} onChange={(e) => setAccommodationCheckOut(e.target.value)} style={{ borderRadius: '12px', height: '44px' }} data-testid="input-checkout" /></div>
                          </div>
                          {!fp.hideRoomsNeeded && (
                          <div><Label className="text-sm" style={{ color: '#666' }}>Rooms Needed</Label><Input type="number" min="1" value={accommodationRooms} onChange={(e) => setAccommodationRooms(parseInt(e.target.value) || 1)} style={{ borderRadius: '12px', height: '44px' }} data-testid="input-rooms" /></div>
                          )}
                        </div>
                      )}
                    </div>
                    )}

                    {showSection.transport && (
                    <div className="p-4" style={{ borderRadius: '10px', border: '1.5px solid #e0e0e0' }}>
                      <div className="flex items-center space-x-3 mb-2">
                        <Checkbox id="needsTransportChk" checked={needsTransport} onCheckedChange={(c) => setNeedsTransport(c as boolean)} data-testid="checkbox-transport" />
                        <Label htmlFor="needsTransportChk" className="cursor-pointer flex items-center gap-2 font-medium text-[14px]">
                          <Car className="h-3.5 w-3.5" style={{ color: OAK_GREEN }} />Local Transport
                        </Label>
                      </div>
                      {needsTransport && (
                        <div className="ml-0 sm:ml-7 mt-2 space-y-3 animate-in fade-in duration-200">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div><Label className="text-sm" style={{ color: '#666' }}>Pickup Date</Label><Input type="date" value={transportPickupDate} onChange={(e) => setTransportPickupDate(e.target.value)} style={{ borderRadius: '12px', height: '44px' }} data-testid="input-transport-pickup-date" /></div>
                            <div><Label className="text-sm" style={{ color: '#666' }}>Pickup Time</Label><Input type="time" value={transportPickupTime} onChange={(e) => setTransportPickupTime(e.target.value)} style={{ borderRadius: '12px', height: '44px' }} data-testid="input-transport-pickup" /></div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div><Label className="text-sm" style={{ color: '#666' }}>Drop Date</Label><Input type="date" value={transportDropDate} onChange={(e) => setTransportDropDate(e.target.value)} style={{ borderRadius: '12px', height: '44px' }} data-testid="input-transport-drop-date" /></div>
                            <div><Label className="text-sm" style={{ color: '#666' }}>Drop Time</Label><Input type="time" value={transportDropTime} onChange={(e) => setTransportDropTime(e.target.value)} style={{ borderRadius: '12px', height: '44px' }} data-testid="input-transport-drop" /></div>
                          </div>
                        </div>
                      )}
                    </div>
                    )}

                    {showSection.tour && (
                      <div className="p-4" style={{ borderRadius: '10px', border: '1.5px solid #e0e0e0' }}>
                        <div className="flex items-center space-x-3 mb-2">
                          <Checkbox id="plansTourChk" checked={plansTourAfterEvent} onCheckedChange={(c) => setPlansTourAfterEvent(c as boolean)} data-testid="checkbox-tour" />
                          <Label htmlFor="plansTourChk" className="cursor-pointer flex items-center gap-2 font-medium text-[14px]">
                            <Compass className="h-3.5 w-3.5" style={{ color: OAK_GREEN }} />Tour after the event
                          </Label>
                        </div>
                        {plansTourAfterEvent && (
                          <div className="ml-0 sm:ml-7 mt-2 space-y-3 animate-in fade-in duration-200">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div><Label className="text-sm" style={{ color: '#666' }}>People</Label><Input type="number" min="1" value={tourPeopleCount} onChange={(e) => setTourPeopleCount(parseInt(e.target.value) || 1)} style={{ borderRadius: '12px', height: '44px' }} data-testid="input-tour-people" /></div>
                              <div><Label className="text-sm" style={{ color: '#666' }}>Days</Label><Input type="number" min="1" value={tourDaysCount} onChange={(e) => setTourDaysCount(parseInt(e.target.value) || 1)} style={{ borderRadius: '12px', height: '44px' }} data-testid="input-tour-days" /></div>
                            </div>
                            <div><Label className="text-sm" style={{ color: '#666' }}>Tour Preferences</Label><Textarea value={tourPlans} onChange={(e) => setTourPlans(e.target.value)} placeholder="Places you'd like to visit?" rows={2} className="resize-none" style={{ borderRadius: '12px' }} data-testid="input-tour-plans" /></div>
                          </div>
                        )}
                      </div>
                    )}

                    {showSection.departure && (
                      <div className="p-4" style={{ borderRadius: '10px', border: '1.5px solid #e0e0e0' }}>
                        <div className="flex items-center gap-2 mb-3">
                          <ArrowRight className="h-3.5 w-3.5" style={{ color: OAK_GREEN }} />
                          <Label className="font-medium text-[14px]">Departure Details</Label>
                        </div>
                        <div className="space-y-3">
                          <div><Label className="text-sm" style={{ color: '#666' }}>Flight / Train Number</Label><Input value={departureFlightTrainNo} onChange={(e) => setDepartureFlightTrainNo(e.target.value)} placeholder="e.g. AI-506 or 12626" style={{ borderRadius: '12px', height: '44px' }} data-testid="input-departure-flight" /></div>
                          <div><Label className="text-sm" style={{ color: '#666' }}>Departure Point</Label><Input value={departurePoint} onChange={(e) => setDeparturePoint(e.target.value)} placeholder="e.g. Cochin International Airport" style={{ borderRadius: '12px', height: '44px' }} data-testid="input-departure-point" /></div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div><Label className="text-sm" style={{ color: '#666' }}>Departure Date</Label><Input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} style={{ borderRadius: '12px', height: '44px' }} data-testid="input-departure-date" /></div>
                            <div><Label className="text-sm" style={{ color: '#666' }}>Departure Time</Label><Input type="time" value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} style={{ borderRadius: '12px', height: '44px' }} data-testid="input-departure-time" /></div>
                          </div>
                        </div>
                      </div>
                    )}

                    {showSection.hotelAllocation && (rsvpSettings.hotelOptions || []).length > 0 && (
                      <div className="p-4" style={{ borderRadius: '10px', border: '1.5px solid #e0e0e0' }}>
                        <div className="flex items-center gap-2 mb-3">
                          <Hotel className="h-3.5 w-3.5" style={{ color: OAK_GREEN }} />
                          <Label className="font-medium text-[14px]">Hotel Preference</Label>
                        </div>
                        <Select value={hotelSelection} onValueChange={setHotelSelection}>
                          <SelectTrigger style={{ borderRadius: '12px', height: '44px' }} data-testid="select-hotel">
                            <SelectValue placeholder="Select your preferred hotel" />
                          </SelectTrigger>
                          <SelectContent>
                            {(rsvpSettings.hotelOptions || []).map((hotel: string) => (
                              <SelectItem key={hotel} value={hotel}>{hotel}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {rsvpSettings.localTransportContactName && (
                      <div className="p-3 text-[13px] flex items-center gap-2" style={{ borderRadius: '10px', backgroundColor: OAK_GREEN_LIGHT }}>
                        <Car className="h-4 w-4" style={{ color: OAK_GREEN }} />
                        <span>Local transport contact: <strong>{rsvpSettings.localTransportContactName}</strong> {rsvpSettings.localTransportContactPhone && (<span>- {rsvpSettings.localTransportContactPhone}</span>)}</span>
                      </div>
                    )}
                  </div>
                </div>
                )}
              </div>
            )}

            {fp.showSpecialNotes !== false && (
            <div>
              <Label htmlFor="notes" className="mb-1.5 block text-[13px] font-medium" style={{ color: '#444' }}>Special Notes or Requests</Label>
              <Textarea id="notes" value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} placeholder="Any special requests please mention here" className="resize-none" rows={3} style={{ borderRadius: '10px', fontSize: '14px' }} data-testid="input-notes" />
            </div>
            )}

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
          Powered by <span style={{ color: '#999' }}>Oakstreet Events</span>
        </p>
      </div>
    </div>
  );
}
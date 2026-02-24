import { useState, useEffect, useMemo } from "react";
import { useRoute } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { Calendar, MapPin, Users, UtensilsCrossed, Check, X, HelpCircle, Loader2, Plane, Hotel, Car, Search, ArrowLeft, User, UserPlus, ArrowRight, Heart } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TEAL = "#0d9488";
const TEAL_LIGHT = "#f0fdfa";

interface FormPageSettings {
  headerTopLine?: string;
  headerInvitationText?: string;
  thankYouAttending?: string;
  thankYouNotAttending?: string;
  showEventsSection?: boolean;
  showGuestCount?: boolean;
  showMealPreference?: boolean;
  showPickupSection?: boolean;
  showAccommodationSection?: boolean;
  showTransportSection?: boolean;
  showTourSection?: boolean;
  showDepartureSection?: boolean;
  showSecondaryContactSection?: boolean;
  showSpecialNotes?: boolean;
  showDietaryRestrictions?: boolean;
  showWhatsAppField?: boolean;
}

interface EventInfo {
  eventId: string;
  title: string;
  eventType?: string;
  date: string;
  venue?: string;
  groomName?: string;
  brideName?: string;
  invitationTitle?: string;
  ceremonies?: string[];
  landingPage: Record<string, any>;
  formPage: FormPageSettings;
}

interface GuestMatch {
  id: string;
  name: string;
  maxAttendees: number;
  phone?: string;
}

type Step = "search" | "form" | "submitted";

export default function KnotviteRsvpForm() {
  const [, params] = useRoute("/knotvite/rsvp/:slug/respond");
  const slug = params?.slug || "";

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
  const [adultCount, setAdultCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [mealPreference, setMealPreference] = useState("");
  const [specialNotes, setSpecialNotes] = useState("");
  const [selfRegName, setSelfRegName] = useState("");
  const [selfRegPhone, setSelfRegPhone] = useState("");
  const [selfRegistering, setSelfRegistering] = useState(false);
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
  const [dietaryRestrictions, setDietaryRestrictions] = useState("");
  const [whatsAppNumber, setWhatsAppNumber] = useState("");

  const { toast } = useToast();

  const fp = eventInfo?.formPage || {} as FormPageSettings;

  const showSection = useMemo(() => {
    return {
      events: fp.showEventsSection !== false,
      guestCount: fp.showGuestCount !== false,
      mealPreference: fp.showMealPreference !== false,
      pickup: fp.showPickupSection ?? false,
      accommodation: fp.showAccommodationSection ?? false,
      transport: fp.showTransportSection ?? false,
      tour: fp.showTourSection ?? false,
      departure: fp.showDepartureSection ?? false,
      secondaryContact: fp.showSecondaryContactSection ?? false,
      specialNotes: fp.showSpecialNotes !== false,
      dietaryRestrictions: fp.showDietaryRestrictions ?? false,
      whatsApp: fp.showWhatsAppField ?? false,
    };
  }, [fp]);

  useEffect(() => {
    if (!slug) return;
    const fetchEvent = async () => {
      try {
        const res = await fetch(`/api/knotvite/public/rsvp/${slug}`);
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "Invalid RSVP link");
          setLoading(false);
          return;
        }
        const data = await res.json();
        setEventInfo(data);
        setLoading(false);

        const urlParams = new URLSearchParams(window.location.search);
        const guestId = urlParams.get('guest');
        if (guestId) {
          try {
            const gRes = await fetch(`/api/knotvite/public/rsvp/${slug}/guest/${guestId}`);
            if (gRes.ok) {
              const gData = await gRes.json();
              if (gData.guest) {
                setSelectedGuest(gData.guest);
                setStep("form");
                if (gData.existingResponse) {
                  const r = gData.existingResponse;
                  setAttendance(r.attendanceStatus || "");
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
                  setDietaryRestrictions(r.dietaryRestrictions || "");
                  setWhatsAppNumber(r.whatsAppNumber || "");
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
  }, [slug]);

  const handleSearch = async () => {
    if (searchName.trim().length < 2) {
      toast({ title: "Please enter at least 2 characters", variant: "destructive" });
      return;
    }
    setSearching(true);
    setSearchDone(false);
    try {
      const res = await fetch(`/api/knotvite/public/rsvp/${slug}/search?name=${encodeURIComponent(searchName.trim())}`);
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
    try {
      const res = await fetch(`/api/knotvite/public/rsvp/${slug}/guest/${guest.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.existingResponse) {
          const r = data.existingResponse;
          setAttendance(r.attendanceStatus || "");
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
      const res = await fetch(`/api/knotvite/public/rsvp/${slug}/respond/${selectedGuest.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceStatus: attendance,
          numberOfAttendees: attendance === "yes" ? (adultCount + childrenCount) : 0,
          numberOfAdults: attendance === "yes" ? adultCount : 0,
          numberOfChildren: attendance === "yes" ? childrenCount : 0,
          mealPreference: attendance === "yes" ? mealPreference : null,
          specialNotes,
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

  const handleSelfRegister = async () => {
    if (selfRegName.trim().length < 2 || selfRegPhone.trim().length < 5) return;
    setSelfRegistering(true);
    try {
      const res = await fetch(`/api/knotvite/public/rsvp/${slug}/self-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selfRegName.trim(), phone: selfRegPhone.trim() }),
      });
      if (!res.ok) throw new Error("Registration failed");
      const guest = await res.json();
      setSelectedGuest({ id: guest.id, name: guest.name, maxAttendees: 1 });
      setStep("form");
    } catch {
      toast({ title: "Error", description: "Registration failed. Please try again.", variant: "destructive" });
    } finally {
      setSelfRegistering(false);
    }
  };

  const handleAnotherGuest = () => {
    setStep("search");
    setSearchName("");
    setSearchResults([]);
    setSearchDone(false);
    setSelectedGuest(null);
    setAttendance("");
    setAdultCount(1);
    setChildrenCount(0);
    setMealPreference("");
    setSpecialNotes("");
    setSelectedFunctions([]);
    setNeedsAirportPickup(false);
    setNeedsAccommodation(false);
    setNeedsTransport(false);
    setDietaryRestrictions("");
    setWhatsAppNumber("");
  };

  const eventDate = eventInfo?.date ? parseISO(eventInfo.date) : null;
  const displayTitle = useMemo(() => {
    if (eventInfo?.invitationTitle) {
      const match = eventInfo.invitationTitle.match(/(?:celebration|wedding|marriage|engagement)\s+of\s+(.+?)\.?\s*$/i);
      if (match) return match[1].trim();
    }
    if (eventInfo?.groomName && eventInfo?.brideName) return `${eventInfo.groomName} & ${eventInfo.brideName}`;
    return eventInfo?.title || '';
  }, [eventInfo]);

  const primaryColor = eventInfo?.landingPage?.primaryColor || TEAL;

  const pageBackground = {
    background: `linear-gradient(145deg, ${primaryColor}08 0%, ${primaryColor}05 30%, #faf8f5 60%, ${primaryColor}03 100%)`,
    position: 'relative' as const,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]" data-testid="loading-state">
        <Heart className="h-8 w-8 animate-pulse" style={{ color: TEAL }} />
      </div>
    );
  }

  if (error || !eventInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] px-4" data-testid="error-state">
        <div className="text-center max-w-md">
          <Heart className="w-12 h-12 mx-auto mb-4 text-gray-300" />
          <h1 className="text-xl font-semibold mb-2">Event Not Found</h1>
          <p className="text-gray-500">{error || 'This RSVP link is no longer active.'}</p>
        </div>
      </div>
    );
  }

  const eventHeader = (
    <div style={{ borderRadius: '16px', background: `linear-gradient(135deg, rgba(255,255,255,0.65) 0%, ${primaryColor}08 50%, rgba(255,255,255,0.65) 100%)`, backdropFilter: 'blur(12px)', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid rgba(255,255,255,0.4)' }}>
      <div className="px-4 sm:px-8 py-6 sm:py-9 text-center">
        <p className="text-[13px] mb-3 font-medium tracking-wide" style={{ color: `${primaryColor}cc` }}>
          {fp.headerTopLine || 'Together with their families'}
        </p>
        <h2 className="text-[26px] sm:text-[34px] mb-3" style={{ fontFamily: "'Georgia', serif", fontWeight: 600, lineHeight: 1.25, color: '#2d2d2d' }}>
          {displayTitle}
        </h2>
        <p className="text-[13px] mb-5 font-medium" style={{ color: `${primaryColor}bb` }}>
          {fp.headerInvitationText || 'cordially invite you to celebrate'}
        </p>
        <div className="flex items-center justify-center gap-3 mb-5">
          <div className="h-px flex-1 max-w-[40px]" style={{ backgroundColor: `${primaryColor}20` }} />
          <Heart className="h-3 w-3" style={{ color: `${primaryColor}60` }} />
          <div className="h-px flex-1 max-w-[40px]" style={{ backgroundColor: `${primaryColor}20` }} />
        </div>
        <div className="flex flex-col items-center gap-2 text-[12px]" style={{ color: '#555' }}>
          {eventDate && (
            <span className="flex items-center gap-1.5 font-medium">
              <Calendar className="h-3 w-3" style={{ color: `${primaryColor}99` }} />
              {format(eventDate, "MMMM d, yyyy")}
            </span>
          )}
          {eventInfo.venue && (
            <span className="flex items-center gap-1.5 font-medium">
              <MapPin className="h-3 w-3" style={{ color: `${primaryColor}99` }} />
              {eventInfo.venue}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (step === "submitted") {
    const thankYouMsg = attendance === "yes"
      ? (fp.thankYouAttending || "We're thrilled you'll be joining us! We can't wait to celebrate together.")
      : (fp.thankYouNotAttending || "We understand and appreciate you letting us know. You'll be missed!");
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={pageBackground} data-testid="submitted-state">
        <div className="max-w-md w-full text-center space-y-6">
          {eventHeader}
          <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
            <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: attendance === "yes" ? '#dcfce7' : '#fef3c7' }}>
              {attendance === "yes" ? <Check className="h-8 w-8 text-green-600" /> : <Heart className="h-8 w-8 text-amber-600" />}
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: "'Georgia', serif" }}>Thank You, {selectedGuest?.name}!</h2>
            <p className="text-gray-600 mb-6">{thankYouMsg}</p>
            <Button onClick={handleAnotherGuest} variant="outline" className="rounded-xl" data-testid="button-another-guest">
              <Users className="h-4 w-4 mr-2" />
              RSVP for another guest
            </Button>
          </div>
          <p className="text-[10px] tracking-[0.2em] uppercase text-gray-300">Powered by KnotVite</p>
        </div>
      </div>
    );
  }

  if (step === "search") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={pageBackground} data-testid="search-state">
        <div className="max-w-md w-full space-y-6">
          {eventHeader}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
            <p className="text-sm font-medium text-center mb-4" style={{ color: primaryColor }}>
              Search your name to RSVP
            </p>
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Enter your name"
                  className="pl-9"
                  style={{ height: '48px', borderRadius: '12px' }}
                  data-testid="input-search-name"
                />
              </div>
              <Button onClick={handleSearch} disabled={searching} style={{ backgroundColor: primaryColor, height: '48px', borderRadius: '12px' }} data-testid="button-search">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>

            {searchDone && searchResults.length > 0 && (
              <div className="space-y-2 mb-4">
                {searchResults.map((guest) => (
                  <button
                    key={guest.id}
                    onClick={() => handleSelectGuest(guest)}
                    className="w-full text-left p-3 rounded-xl border border-gray-100 hover:border-teal-200 hover:bg-teal-50/50 transition-colors flex items-center gap-3"
                    data-testid={`guest-result-${guest.id}`}
                  >
                    <div className="h-10 w-10 rounded-full flex items-center justify-center text-white text-sm font-medium" style={{ backgroundColor: primaryColor }}>
                      {guest.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{guest.name}</p>
                      <p className="text-xs text-gray-400">Tap to continue</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-300" />
                  </button>
                ))}
              </div>
            )}

            {searchDone && searchResults.length === 0 && (
              <div className="text-center py-4 text-sm text-gray-500">
                No invitation found. You can register below.
              </div>
            )}

            <div className="border-t pt-4 mt-4">
              <p className="text-xs text-gray-400 text-center mb-3">Not on the list? Register yourself:</p>
              <div className="space-y-3">
                <Input
                  value={selfRegName}
                  onChange={(e) => setSelfRegName(e.target.value)}
                  placeholder="Your full name"
                  style={{ height: '44px', borderRadius: '12px' }}
                  data-testid="input-self-reg-name"
                />
                <Input
                  value={selfRegPhone}
                  onChange={(e) => setSelfRegPhone(e.target.value)}
                  placeholder="Phone number"
                  style={{ height: '44px', borderRadius: '12px' }}
                  data-testid="input-self-reg-phone"
                />
                <Button
                  className="w-full text-white"
                  style={{ backgroundColor: primaryColor, height: '44px', borderRadius: '12px' }}
                  onClick={handleSelfRegister}
                  disabled={selfRegistering || selfRegName.trim().length < 2 || selfRegPhone.trim().length < 5}
                  data-testid="button-self-register"
                >
                  {selfRegistering ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserPlus className="h-4 w-4 mr-2" />Register & RSVP</>}
                </Button>
              </div>
            </div>
          </div>
          <p className="text-[10px] tracking-[0.2em] uppercase text-gray-300 text-center">Powered by KnotVite</p>
        </div>
      </div>
    );
  }

  const guestCount = adultCount + childrenCount;

  return (
    <div className="min-h-screen px-4 py-8" style={pageBackground} data-testid="form-state">
      <div className="max-w-lg mx-auto space-y-4">
        {eventHeader}

        <div className="bg-white rounded-2xl shadow-lg p-5 sm:p-6 border border-gray-100">
          <div className="flex items-center gap-2 mb-5">
            <button onClick={() => setStep("search")} className="text-gray-400 hover:text-gray-600" data-testid="button-back">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <p className="font-semibold text-sm">{selectedGuest?.name}</p>
              <p className="text-xs text-gray-400">RSVP Form</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <Label className="text-sm font-semibold mb-3 block" style={{ color: primaryColor }}>
                Will you be attending?
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: "yes", label: "Yes", icon: Check, color: "bg-green-50 border-green-200 text-green-700" },
                  { value: "no", label: "No", icon: X, color: "bg-red-50 border-red-200 text-red-700" },
                  { value: "maybe", label: "Maybe", icon: HelpCircle, color: "bg-amber-50 border-amber-200 text-amber-700" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setAttendance(opt.value)}
                    className={`p-3 rounded-xl border-2 text-center transition-all ${attendance === opt.value ? opt.color + ' ring-2 ring-offset-1' : 'border-gray-100 hover:border-gray-200'}`}
                    style={attendance === opt.value ? { ringColor: primaryColor } : {}}
                    data-testid={`attendance-${opt.value}`}
                  >
                    <opt.icon className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-xs font-medium">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {attendance === "yes" && (
              <>
                {showSection.events && eventInfo.ceremonies && eventInfo.ceremonies.length > 0 && (
                  <div>
                    <Label className="text-sm font-semibold mb-3 block">Which ceremonies will you attend?</Label>
                    <div className="space-y-2">
                      {eventInfo.ceremonies.map((fn, idx) => (
                        <label key={idx} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer" data-testid={`ceremony-${idx}`}>
                          <Checkbox
                            checked={selectedFunctions.includes(fn)}
                            onCheckedChange={(checked) => {
                              if (checked) setSelectedFunctions(prev => [...prev, fn]);
                              else setSelectedFunctions(prev => prev.filter(f => f !== fn));
                            }}
                          />
                          <span className="text-sm">{fn}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {showSection.guestCount && (
                  <div>
                    <Label className="text-sm font-semibold mb-3 block">
                      <Users className="h-4 w-4 inline mr-1" style={{ color: primaryColor }} />
                      Number of Guests
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-gray-500">Adults</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setAdultCount(Math.max(1, adultCount - 1))} data-testid="btn-adult-minus">-</Button>
                          <span className="text-lg font-semibold w-8 text-center" data-testid="text-adult-count">{adultCount}</span>
                          <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setAdultCount(adultCount + 1)} data-testid="btn-adult-plus">+</Button>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Children</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setChildrenCount(Math.max(0, childrenCount - 1))} data-testid="btn-child-minus">-</Button>
                          <span className="text-lg font-semibold w-8 text-center" data-testid="text-child-count">{childrenCount}</span>
                          <Button variant="outline" size="icon" className="h-9 w-9 rounded-lg" onClick={() => setChildrenCount(childrenCount + 1)} data-testid="btn-child-plus">+</Button>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">Total: {guestCount} guest{guestCount !== 1 ? 's' : ''}</p>
                  </div>
                )}

                {showSection.mealPreference && (
                  <div>
                    <Label className="text-sm font-semibold mb-3 block">
                      <UtensilsCrossed className="h-4 w-4 inline mr-1" style={{ color: primaryColor }} />
                      Meal Preference
                    </Label>
                    <RadioGroup value={mealPreference} onValueChange={setMealPreference} className="grid grid-cols-2 gap-2">
                      {[
                        { value: "vegetarian", label: "Vegetarian", emoji: "🥬" },
                        { value: "non_vegetarian", label: "Non-Veg", emoji: "🍗" },
                        { value: "both", label: "Both", emoji: "🍽️" },
                        { value: "no_preference", label: "No Pref", emoji: "👍" },
                      ].map((opt) => (
                        <label key={opt.value} className={`flex items-center gap-2 p-3 rounded-xl border-2 cursor-pointer transition-all ${mealPreference === opt.value ? 'border-teal-300 bg-teal-50' : 'border-gray-100 hover:border-gray-200'}`} data-testid={`meal-${opt.value}`}>
                          <RadioGroupItem value={opt.value} className="sr-only" />
                          <span className="text-lg">{opt.emoji}</span>
                          <span className="text-xs font-medium">{opt.label}</span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                )}

                {showSection.pickup && (
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer" data-testid="toggle-pickup">
                      <Checkbox checked={needsAirportPickup} onCheckedChange={(c) => setNeedsAirportPickup(!!c)} />
                      <Plane className="h-4 w-4" style={{ color: primaryColor }} />
                      <span className="text-sm font-medium">Need Airport/Station Pickup?</span>
                    </label>
                    {needsAirportPickup && (
                      <div className="grid grid-cols-2 gap-3 pl-4">
                        <div><Label className="text-xs">Flight/Train No</Label><Input value={pickupFlightTrainNo} onChange={(e) => setPickupFlightTrainNo(e.target.value)} className="mt-1" style={{ borderRadius: '10px' }} data-testid="input-pickup-flight" /></div>
                        <div><Label className="text-xs">Pickup Point</Label><Input value={pickupPoint} onChange={(e) => setPickupPoint(e.target.value)} className="mt-1" style={{ borderRadius: '10px' }} data-testid="input-pickup-point" /></div>
                        <div><Label className="text-xs">Date</Label><Input type="date" value={pickupDate} onChange={(e) => setPickupDate(e.target.value)} className="mt-1" style={{ borderRadius: '10px' }} data-testid="input-pickup-date" /></div>
                        <div><Label className="text-xs">Time</Label><Input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="mt-1" style={{ borderRadius: '10px' }} data-testid="input-pickup-time" /></div>
                      </div>
                    )}
                  </div>
                )}

                {showSection.accommodation && (
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer" data-testid="toggle-accommodation">
                      <Checkbox checked={needsAccommodation} onCheckedChange={(c) => setNeedsAccommodation(!!c)} />
                      <Hotel className="h-4 w-4" style={{ color: primaryColor }} />
                      <span className="text-sm font-medium">Need Accommodation?</span>
                    </label>
                    {needsAccommodation && (
                      <div className="grid grid-cols-2 gap-3 pl-4">
                        <div><Label className="text-xs">Check-in</Label><Input type="date" value={accommodationCheckIn} onChange={(e) => setAccommodationCheckIn(e.target.value)} className="mt-1" style={{ borderRadius: '10px' }} data-testid="input-checkin" /></div>
                        <div><Label className="text-xs">Check-out</Label><Input type="date" value={accommodationCheckOut} onChange={(e) => setAccommodationCheckOut(e.target.value)} className="mt-1" style={{ borderRadius: '10px' }} data-testid="input-checkout" /></div>
                        <div><Label className="text-xs">Rooms Needed</Label><Input type="number" min="1" value={accommodationRooms} onChange={(e) => setAccommodationRooms(parseInt(e.target.value) || 1)} className="mt-1" style={{ borderRadius: '10px' }} data-testid="input-rooms" /></div>
                      </div>
                    )}
                  </div>
                )}

                {showSection.transport && (
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 cursor-pointer" data-testid="toggle-transport">
                      <Checkbox checked={needsTransport} onCheckedChange={(c) => setNeedsTransport(!!c)} />
                      <Car className="h-4 w-4" style={{ color: primaryColor }} />
                      <span className="text-sm font-medium">Need Local Transport?</span>
                    </label>
                    {needsTransport && (
                      <div className="grid grid-cols-2 gap-3 pl-4">
                        <div><Label className="text-xs">Pickup Date</Label><Input type="date" value={transportPickupDate} onChange={(e) => setTransportPickupDate(e.target.value)} className="mt-1" style={{ borderRadius: '10px' }} data-testid="input-transport-pickup-date" /></div>
                        <div><Label className="text-xs">Pickup Time</Label><Input type="time" value={transportPickupTime} onChange={(e) => setTransportPickupTime(e.target.value)} className="mt-1" style={{ borderRadius: '10px' }} data-testid="input-transport-pickup-time" /></div>
                        <div><Label className="text-xs">Drop Date</Label><Input type="date" value={transportDropDate} onChange={(e) => setTransportDropDate(e.target.value)} className="mt-1" style={{ borderRadius: '10px' }} data-testid="input-transport-drop-date" /></div>
                        <div><Label className="text-xs">Drop Time</Label><Input type="time" value={transportDropTime} onChange={(e) => setTransportDropTime(e.target.value)} className="mt-1" style={{ borderRadius: '10px' }} data-testid="input-transport-drop-time" /></div>
                      </div>
                    )}
                  </div>
                )}

                {showSection.dietaryRestrictions && (
                  <div>
                    <Label className="text-xs font-medium">Dietary Restrictions / Allergies</Label>
                    <Input value={dietaryRestrictions} onChange={(e) => setDietaryRestrictions(e.target.value)} placeholder="Any allergies or dietary needs..." className="mt-1" style={{ borderRadius: '10px' }} data-testid="input-dietary" />
                  </div>
                )}

                {showSection.whatsApp && (
                  <div>
                    <Label className="text-xs font-medium">WhatsApp Number</Label>
                    <Input value={whatsAppNumber} onChange={(e) => setWhatsAppNumber(e.target.value)} placeholder="+91 9876543210" className="mt-1" style={{ borderRadius: '10px' }} data-testid="input-whatsapp" />
                  </div>
                )}
              </>
            )}

            {showSection.specialNotes && (
              <div>
                <Label className="text-xs font-medium">Special Notes / Requests</Label>
                <Textarea value={specialNotes} onChange={(e) => setSpecialNotes(e.target.value)} placeholder="Any special requests or notes..." className="mt-1" style={{ borderRadius: '10px' }} rows={3} data-testid="input-special-notes" />
              </div>
            )}

            <Button
              className="w-full text-white text-base font-semibold"
              style={{ backgroundColor: primaryColor, height: '52px', borderRadius: '14px' }}
              onClick={handleSubmit}
              disabled={submitting || !attendance}
              data-testid="button-submit-rsvp"
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Submit RSVP'}
            </Button>
          </div>
        </div>

        <p className="text-[10px] tracking-[0.2em] uppercase text-gray-300 text-center">Powered by KnotVite</p>
      </div>
    </div>
  );
}

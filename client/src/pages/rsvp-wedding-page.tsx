import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { format, parseISO, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from "date-fns";
import { Calendar, MapPin, Clock, Heart, ChevronDown, Loader2, Sparkles, Search, UserPlus, User } from "lucide-react";
import sampleCouple from "@assets/sample-couple.jpg";

interface LandingConfig {
  heroImageUrl?: string;
  heroImagePosition?: number;
  groomName?: string;
  brideName?: string;
  tagline?: string;
  welcomeTitle?: string;
  welcomeMessage?: string;
  venueImageUrl?: string;
  footerMessage?: string;
  primaryColor?: string;
  accentColor?: string;
  rsvpButtonText?: string;
  rsvpSubtext?: string;
  showCountdown?: boolean;
  showCeremonies?: boolean;
  customMessage?: string;
  backgroundOverlayOpacity?: number;
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
  rsvpSettings?: any;
  landingPage?: LandingConfig;
}

function useCountdown(targetDate: string | null) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!targetDate) return null;
  const target = new Date(targetDate);
  if (now >= target) return null;

  const days = differenceInDays(target, now);
  const hours = differenceInHours(target, now) % 24;
  const minutes = differenceInMinutes(target, now) % 60;
  const seconds = differenceInSeconds(target, now) % 60;
  return { days, hours, minutes, seconds };
}

function extractNames(title: string): { name1: string; name2: string; taglineFromTitle?: string } {
  const cleanTitle = title.replace(/\.\s*$/, '').trim();

  const ofPattern = /(?:celebration|wedding|union|marriage|engagement)\s+of\s+(.+)/i;
  const ofMatch = cleanTitle.match(ofPattern);
  if (ofMatch) {
    const namesStr = ofMatch[1].trim();
    const taglineFromTitle = cleanTitle.replace(ofMatch[1], '').replace(/\s+of\s*$/i, '').trim();
    const separators = [' & ', ' and ', ' AND '];
    for (const sep of separators) {
      if (namesStr.includes(sep)) {
        const parts = namesStr.split(sep);
        return { name1: parts[0].trim(), name2: parts[1].trim(), taglineFromTitle };
      }
    }
    return { name1: namesStr, name2: '', taglineFromTitle };
  }

  const separators = [' & ', ' and ', ' AND ', ' x ', ' X ', ' + '];
  for (const sep of separators) {
    if (cleanTitle.includes(sep)) {
      const parts = cleanTitle.split(sep);
      const left = parts[0].trim();
      const right = parts[1].trim();
      if (left.split(' ').length <= 3 && right.split(' ').length <= 3) {
        return { name1: left, name2: right };
      }
    }
  }

  if (cleanTitle.split(' ').length <= 4) {
    const words = cleanTitle.split(' ');
    if (words.length >= 2) {
      const mid = Math.ceil(words.length / 2);
      return { name1: words.slice(0, mid).join(' '), name2: words.slice(mid).join(' ') };
    }
  }

  return { name1: cleanTitle, name2: '' };
}

function FloralCorner({ position, color }: { position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'; color: string }) {
  const transforms: Record<string, string> = {
    'top-left': '',
    'top-right': 'scaleX(-1)',
    'bottom-left': 'scaleY(-1)',
    'bottom-right': 'scale(-1)',
  };
  const positions: Record<string, string> = {
    'top-left': 'top-0 left-0',
    'top-right': 'top-0 right-0',
    'bottom-left': 'bottom-0 left-0',
    'bottom-right': 'bottom-0 right-0',
  };

  return (
    <div className={`absolute ${positions[position]} w-24 h-24 sm:w-32 sm:h-32 opacity-20 pointer-events-none`} style={{ transform: transforms[position] }}>
      <svg viewBox="0 0 100 100" fill="none" className="w-full h-full">
        <path d="M0 0 Q30 5 50 30 Q55 15 45 5 Q35 0 0 0 Z" fill={color} opacity="0.6" />
        <path d="M0 0 Q5 30 30 50 Q15 55 5 45 Q0 35 0 0 Z" fill={color} opacity="0.6" />
        <path d="M10 0 Q25 20 40 35 Q30 25 20 10 Z" fill={color} opacity="0.3" />
        <circle cx="35" cy="35" r="3" fill={color} opacity="0.5" />
        <circle cx="20" cy="25" r="2" fill={color} opacity="0.4" />
        <circle cx="25" cy="15" r="1.5" fill={color} opacity="0.3" />
      </svg>
    </div>
  );
}

export default function RsvpWeddingPage() {
  const [, params] = useRoute("/rsvp/e/:code");
  const code = params?.code || "";
  const [, setLocation] = useLocation();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventInfo, setEventInfo] = useState<EventInfo | null>(null);
  const [scrollY, setScrollY] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const detailsRef = useRef<HTMLDivElement>(null);
  const [searchName, setSearchName] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSelfRegister, setShowSelfRegister] = useState(false);
  const [selfRegName, setSelfRegName] = useState("");
  const [selfRegPhone, setSelfRegPhone] = useState("");
  const [registering, setRegistering] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      } catch {
        setError("Unable to load event information.");
        setLoading(false);
      }
    };
    fetchEvent();
  }, [code]);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!detailsRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    observer.observe(detailsRef.current);
    return () => observer.disconnect();
  }, [loading]);

  const lp = eventInfo?.landingPage || {};
  const primaryColor = lp.primaryColor || '#4b7c29';
  const accentColor = lp.accentColor || '#d4a574';
  const overlayOpacity = (lp.backgroundOverlayOpacity ?? 40) / 100;

  const countdown = useCountdown(eventInfo?.date || null);
  const nameData = useMemo(() => {
    if (!eventInfo) return { name1: '', name2: '', taglineFromTitle: undefined as string | undefined };
    if (lp.groomName || lp.brideName) {
      return { name1: lp.groomName || '', name2: lp.brideName || '', taglineFromTitle: undefined as string | undefined };
    }
    return extractNames(eventInfo.rsvpTitle || eventInfo.customer || eventInfo.title);
  }, [eventInfo, lp.groomName, lp.brideName]);
  const names = nameData;

  const formattedDate = useMemo(() => {
    if (!eventInfo?.date) return '';
    try { return format(parseISO(eventInfo.date), 'MMMM d, yyyy'); } catch { return eventInfo.date; }
  }, [eventInfo?.date]);

  const dayOfWeek = useMemo(() => {
    if (!eventInfo?.date) return '';
    try { return format(parseISO(eventInfo.date), 'EEEE'); } catch { return ''; }
  }, [eventInfo?.date]);

  const dayNum = useMemo(() => {
    if (!eventInfo?.date) return '';
    try { return format(parseISO(eventInfo.date), 'd'); } catch { return ''; }
  }, [eventInfo?.date]);

  const monthYear = useMemo(() => {
    if (!eventInfo?.date) return '';
    try { return format(parseISO(eventInfo.date), 'MMMM yyyy'); } catch { return ''; }
  }, [eventInfo?.date]);

  const eventType = (eventInfo?.type || 'wedding').toLowerCase();
  const isWedding = eventType.includes('wedding');

  const handleSearchChange = useCallback((value: string) => {
    setSearchName(value);
    setShowSelfRegister(false);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (value.trim().length < 1) {
      setSearchResults([]);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/rsvp/event/${code}/search?name=${encodeURIComponent(value.trim())}`);
        const data = await res.json();
        setSearchResults(data.guests || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 250);
  }, [code]);

  const handleSelectGuest = (guestId: string) => {
    setLocation(`/rsvp/e/${code}/respond?guest=${guestId}`);
  };

  const handleSelfRegister = async () => {
    if (selfRegName.trim().length < 2 || selfRegPhone.trim().length < 5) return;
    setRegistering(true);
    try {
      const res = await fetch(`/api/rsvp/event/${code}/self-register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: selfRegName.trim(), phone: selfRegPhone.trim() }),
      });
      if (!res.ok) throw new Error("Registration failed");
      const guest = await res.json();
      setLocation(`/rsvp/e/${code}/respond?guest=${guest.id}`);
    } catch {
      setRegistering(false);
    }
  };

  const scrollToDetails = () => document.getElementById('event-details')?.scrollIntoView({ behavior: 'smooth' });

  const heroImage = lp.heroImageUrl || sampleCouple;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5]">
        <div className="text-center">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-2 border-gray-100 flex items-center justify-center mx-auto mb-6" style={{ borderColor: `${primaryColor}30` }}>
              <Heart className="w-6 h-6 animate-pulse" style={{ color: primaryColor }} />
            </div>
          </div>
          <p className="font-light text-sm tracking-[0.3em] uppercase text-gray-400">Opening your invitation</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full border-2 border-gray-200 flex items-center justify-center">
            <Heart className="w-8 h-8 text-gray-300" />
          </div>
          <h1 className="text-2xl text-gray-800 mb-3" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>Invitation Not Found</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!eventInfo) return null;

  const tagline = lp.tagline || nameData.taglineFromTitle || (isWedding ? 'Together with their families' : 'You are invited to');
  const welcomeTitle = lp.welcomeTitle || (isWedding ? 'Join Us on Our Special Day' : 'Event Details');
  const welcomeMessage = lp.welcomeMessage || 'We would be honored by your presence';
  const rsvpButtonText = lp.rsvpButtonText || 'Kindly Respond';
  const footerMessage = lp.footerMessage || 'Crafted with love by Oakstreet Events';
  const showCountdown = lp.showCountdown !== false;
  const showCeremonies = lp.showCeremonies !== false;

  return (
    <div className="min-h-screen bg-[#faf8f5] overflow-x-hidden" data-testid="rsvp-wedding-page">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500&family=Montserrat:wght@200;300;400;500;600&family=Great+Vibes&display=swap');
        .font-script { font-family: 'Great Vibes', cursive; }
        .font-serif-display { font-family: 'Playfair Display', 'Georgia', serif; }
        .font-serif-elegant { font-family: 'Cormorant Garamond', 'Georgia', serif; }
        .font-sans-clean { font-family: 'Montserrat', sans-serif; }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes gentlePulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .animate-fade-up { animation: fadeInUp 1.2s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .animate-fade-up-d1 { animation: fadeInUp 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.15s forwards; opacity: 0; }
        .animate-fade-up-d2 { animation: fadeInUp 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.3s forwards; opacity: 0; }
        .animate-fade-up-d3 { animation: fadeInUp 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.5s forwards; opacity: 0; }
        .animate-fade-up-d4 { animation: fadeInUp 1.2s cubic-bezier(0.22, 1, 0.36, 1) 0.7s forwards; opacity: 0; }
        .animate-fade-in { animation: fadeIn 2s ease-out forwards; }
        .animate-scale-in { animation: scaleIn 1s cubic-bezier(0.22, 1, 0.36, 1) forwards; }
        .shimmer-text {
          background: linear-gradient(90deg, rgba(255,255,255,0.8), rgba(255,255,255,1), rgba(255,255,255,0.8));
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          animation: shimmer 3s linear infinite;
        }
        .gentle-pulse { animation: gentlePulse 3s ease-in-out infinite; }
        .glass-card {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
        }
      `}</style>

      {/* Hero Section */}
      <section className="relative h-screen flex flex-col items-end justify-end overflow-hidden" data-testid="hero-section">
        <img 
          src={heroImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
          style={{ 
            objectPosition: `50% ${lp.heroImagePosition ?? 35}%`,
            transform: `translateY(${scrollY * 0.08}px)`,
          }}
        />
        <div 
          className="absolute inset-0"
          style={{
            background: `linear-gradient(180deg, rgba(0,0,0,${overlayOpacity * 0.15}) 0%, rgba(0,0,0,${overlayOpacity * 0.05}) 25%, rgba(0,0,0,${overlayOpacity * 0.1}) 45%, rgba(0,0,0,${overlayOpacity * 0.5}) 70%, rgba(0,0,0,${overlayOpacity * 0.9}) 100%)`,
          }}
        />

        <FloralCorner position="top-left" color="rgba(255,255,255,0.15)" />
        <FloralCorner position="top-right" color="rgba(255,255,255,0.15)" />

        <div className="relative z-10 text-center text-white px-4 sm:px-6 pb-6 sm:pb-12 w-full max-w-2xl mx-auto flex flex-col items-center">
          <div className="animate-fade-up mb-1">
            <p className="font-sans-clean text-[9px] sm:text-[10px] tracking-[0.5em] uppercase text-white/60">
              {tagline}
            </p>
          </div>

          <div className="animate-fade-up-d1 mb-4">
            <h1 className="font-serif-display text-4xl sm:text-5xl md:text-6xl font-medium leading-[0.95] mb-2 shimmer-text">
              {names.name1}
            </h1>
            {names.name2 && (
              <>
                <div className="flex items-center justify-center gap-4 my-2 sm:my-3">
                  <div className="h-px w-10 sm:w-16" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}80)` }} />
                  <span className="font-script text-2xl sm:text-3xl" style={{ color: accentColor }}>&amp;</span>
                  <div className="h-px w-10 sm:w-16" style={{ background: `linear-gradient(270deg, transparent, ${accentColor}80)` }} />
                </div>
                <h1 className="font-serif-display text-4xl sm:text-5xl md:text-6xl font-medium leading-[0.95] shimmer-text">
                  {names.name2}
                </h1>
              </>
            )}
          </div>

          <div className="animate-fade-up-d2">
            <div className="flex items-center justify-center gap-3 mb-1">
              <div className="h-px w-8" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}60)` }} />
              <Sparkles className="w-3 h-3 gentle-pulse" style={{ color: accentColor }} />
              <div className="h-px w-8" style={{ background: `linear-gradient(270deg, transparent, ${accentColor}60)` }} />
            </div>
            <p className="font-serif-elegant text-base sm:text-lg tracking-wide text-white/80 mb-0.5">
              {formattedDate}
            </p>
            {eventInfo.venue && (
              <p className="font-sans-clean text-[9px] sm:text-[10px] tracking-[0.3em] uppercase text-white/50">
                {eventInfo.venue}
              </p>
            )}
          </div>

          <div className="animate-fade-up-d4 mt-8 sm:mt-10">
            <button 
              onClick={scrollToDetails}
              className="inline-flex flex-col items-center gap-2 text-white/40 hover:text-white/70 transition-all duration-500 group"
              data-testid="button-scroll-down"
            >
              <span className="font-sans-clean text-[9px] tracking-[0.4em] uppercase">Discover More</span>
              <div className="w-px h-6 bg-gradient-to-b from-white/40 to-transparent group-hover:h-10 transition-all duration-500" />
            </button>
          </div>
        </div>
      </section>

      {/* Elegant Divider */}
      <div className="relative z-10 bg-[#faf8f5]">
        <div className="absolute -top-px left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}30, transparent)` }} />
      </div>

      {/* Personal Message Section (if configured) */}
      {lp.customMessage && (
        <section className="relative z-10 py-16 sm:py-20 bg-[#faf8f5]">
          <div className="max-w-xl mx-auto px-4 sm:px-8 text-center">
            <div className="relative">
              <FloralCorner position="top-left" color={`${primaryColor}30`} />
              <FloralCorner position="bottom-right" color={`${primaryColor}30`} />
              <div className="py-8">
                <Sparkles className="w-4 h-4 mx-auto mb-4" style={{ color: accentColor }} />
                <p className="font-serif-elegant text-lg sm:text-xl leading-relaxed text-gray-600 italic">
                  "{lp.customMessage}"
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Event Details Section */}
      <section 
        id="event-details" 
        ref={detailsRef}
        className="relative z-10 py-20 sm:py-28 bg-[#faf8f5]" 
        data-testid="details-section"
      >
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className={`mb-14 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="flex items-center justify-center gap-4 mb-6">
              <div className="h-px w-16" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}50)` }} />
              <Heart className="w-4 h-4" style={{ color: primaryColor }} />
              <div className="h-px w-16" style={{ background: `linear-gradient(270deg, transparent, ${accentColor}50)` }} />
            </div>
            <h2 className="font-serif-display text-3xl sm:text-4xl text-gray-800 mb-3">
              {welcomeTitle}
            </h2>
            <p className="font-serif-elegant text-lg sm:text-xl text-gray-400 italic">
              {welcomeMessage}
            </p>
          </div>

          {/* Date Card with glass effect */}
          <div 
            className={`glass-card rounded-3xl shadow-lg border border-white/50 p-5 sm:p-12 mb-10 transition-all duration-1000 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
            data-testid="card-event-details"
          >
            <FloralCorner position="top-left" color={`${primaryColor}25`} />
            <FloralCorner position="top-right" color={`${primaryColor}25`} />
            <FloralCorner position="bottom-left" color={`${primaryColor}25`} />
            <FloralCorner position="bottom-right" color={`${primaryColor}25`} />

            <div className="relative z-10">
              <p className="font-sans-clean text-[10px] tracking-[0.5em] uppercase mb-3" style={{ color: accentColor }}>
                {dayOfWeek}
              </p>
              <p className="font-serif-display text-5xl sm:text-7xl font-bold mb-2" style={{ color: primaryColor }}>
                {dayNum}
              </p>
              <p className="font-serif-elegant text-2xl sm:text-3xl text-gray-600 mb-6">
                {monthYear}
              </p>

              <div className="h-px w-24 mx-auto mb-8" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}50, transparent)` }} />

              {eventInfo.time && (
                <div className="flex items-center justify-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}10` }}>
                    <Clock className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                  </div>
                  <p className="font-sans-clean text-sm tracking-wider text-gray-700">{eventInfo.time}</p>
                </div>
              )}

              {eventInfo.venue && (
                <div className="flex items-center justify-center gap-3 mb-5">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}10` }}>
                    <MapPin className="w-3.5 h-3.5" style={{ color: primaryColor }} />
                  </div>
                  <p className="font-serif-elegant text-lg text-gray-700">{eventInfo.venue}</p>
                </div>
              )}

              {/* Venue Image */}
              {lp.venueImageUrl && (
                <div className="mt-8 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
                  <img src={lp.venueImageUrl} alt="Venue" className="w-full h-48 sm:h-64 object-cover" />
                </div>
              )}

              {showCeremonies && eventInfo.rsvpFunctions && eventInfo.rsvpFunctions.length > 0 && (
                <div className="mt-10 pt-8 border-t border-gray-100">
                  <p className="font-sans-clean text-[10px] tracking-[0.5em] uppercase mb-5" style={{ color: accentColor }}>
                    Ceremonies
                  </p>
                  <div className="flex flex-wrap justify-center gap-3">
                    {eventInfo.rsvpFunctions.map((fn, i) => (
                      <span
                        key={i}
                        className="font-sans-clean text-xs px-3 py-2 sm:px-5 sm:py-2.5 rounded-full border-2 transition-colors duration-300 hover:text-white"
                        style={{ 
                          borderColor: `${primaryColor}30`,
                          color: primaryColor,
                        }}
                        onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = primaryColor; (e.target as HTMLElement).style.color = 'white'; }}
                        onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; (e.target as HTMLElement).style.color = primaryColor; }}
                        data-testid={`badge-ceremony-${i}`}
                      >
                        {fn}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Countdown Timer */}
          {showCountdown && countdown && (
            <div className={`mb-14 transition-all duration-1000 delay-400 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} data-testid="countdown">
              <p className="font-sans-clean text-[10px] tracking-[0.5em] uppercase mb-8" style={{ color: accentColor }}>
                Counting Down To Forever
              </p>
              <div className="flex items-center justify-center gap-3 sm:gap-6">
                {[
                  { value: countdown.days, label: 'Days' },
                  { value: countdown.hours, label: 'Hours' },
                  { value: countdown.minutes, label: 'Min' },
                  { value: countdown.seconds, label: 'Sec' },
                ].map((item, i) => (
                  <div key={i} className="text-center" data-testid={`countdown-${item.label.toLowerCase()}`}>
                    <div 
                      className="w-14 h-14 sm:w-20 sm:h-20 rounded-2xl glass-card shadow-md border border-white/60 flex items-center justify-center mb-2"
                    >
                      <span className="font-serif-display text-xl sm:text-3xl font-bold" style={{ color: primaryColor }}>
                        {String(item.value).padStart(2, '0')}
                      </span>
                    </div>
                    <span className="font-sans-clean text-[9px] tracking-[0.2em] uppercase text-gray-400">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* RSVP Search Section */}
          <div className={`mt-12 w-full max-w-md mx-auto transition-all duration-1000 delay-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`} data-testid="rsvp-section">
            <p className="font-sans-clean text-[13px] tracking-[0.3em] uppercase mb-6 font-medium" style={{ color: '#555' }}>
              Search your name to RSVP
            </p>

            <div className="relative">
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  <Input
                    value={searchName}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Search your name..."
                    className="pl-10 bg-white/90 backdrop-blur-sm border-gray-200 focus:border-transparent"
                    style={{ height: '52px', borderRadius: '26px', fontSize: '15px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
                    data-testid="input-landing-search"
                  />
                  {searching && (
                    <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                  )}
                </div>
                <button
                  onClick={() => { setShowSelfRegister(!showSelfRegister); setSearchName(""); setSearchResults([]); setSelfRegName(""); setSelfRegPhone(""); }}
                  className="flex-shrink-0 h-[52px] w-[52px] rounded-full flex items-center justify-center text-white transition-all duration-300 hover:scale-105 active:scale-95 shadow-md"
                  style={{ backgroundColor: primaryColor }}
                  title="Add your name"
                  data-testid="button-self-register"
                >
                  <UserPlus className="h-5 w-5" />
                </button>
              </div>

              {/* Search Results Dropdown */}
              {searchName.trim().length >= 1 && searchResults.length > 0 && (
                <div className="absolute left-0 right-14 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-20 animate-in fade-in slide-in-from-top-2 duration-200" data-testid="search-results-dropdown">
                  {searchResults.map((guest) => (
                    <button
                      key={guest.id}
                      onClick={() => handleSelectGuest(guest.id)}
                      className="w-full text-left px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                      data-testid={`result-guest-${guest.id}`}
                    >
                      <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0" style={{ backgroundColor: primaryColor }}>
                        {guest.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900">{guest.name}</p>
                        <p className="text-[11px] text-gray-400">Tap to RSVP</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* No Results */}
              {searchName.trim().length >= 2 && !searching && searchResults.length === 0 && (
                <div className="absolute left-0 right-14 mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 p-5 text-center z-20 animate-in fade-in duration-200">
                  <p className="text-sm text-gray-500">No invitation found for "{searchName}"</p>
                  <button
                    onClick={() => { setShowSelfRegister(true); setSelfRegName(searchName.trim()); setSearchName(""); setSearchResults([]); }}
                    className="text-sm font-medium mt-2 flex items-center gap-1.5 mx-auto"
                    style={{ color: primaryColor }}
                    data-testid="link-register-from-search"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    Register & RSVP instead
                  </button>
                </div>
              )}
            </div>

            {/* Self Register Form */}
            {showSelfRegister && (
              <div className="mt-4 bg-white/90 backdrop-blur-sm rounded-2xl p-4 sm:p-6 shadow-lg border border-gray-100 animate-in fade-in slide-in-from-bottom-3 duration-300" data-testid="self-register-form">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-4 w-4" style={{ color: primaryColor }} />
                  <p className="text-sm font-semibold text-gray-800">Register & RSVP</p>
                </div>
                <div className="space-y-3">
                  <Input
                    value={selfRegName}
                    onChange={(e) => setSelfRegName(e.target.value)}
                    placeholder="Your full name"
                    style={{ height: '48px', borderRadius: '12px', fontSize: '14px' }}
                    data-testid="input-landing-reg-name"
                  />
                  <Input
                    value={selfRegPhone}
                    onChange={(e) => setSelfRegPhone(e.target.value)}
                    placeholder="Phone number"
                    style={{ height: '48px', borderRadius: '12px', fontSize: '14px' }}
                    data-testid="input-landing-reg-phone"
                  />
                  <button
                    onClick={handleSelfRegister}
                    disabled={registering || selfRegName.trim().length < 2 || selfRegPhone.trim().length < 5}
                    className="w-full py-3.5 text-white text-sm font-medium rounded-full transition-all duration-300 hover:shadow-lg hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                    style={{ backgroundColor: primaryColor }}
                    data-testid="button-landing-register"
                  >
                    {registering ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Continue to RSVP"}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={() => setLocation(`/rsvp/e/${code}/respond`)}
              className="group relative mt-6 px-8 sm:px-12 py-3 font-sans-clean text-xs tracking-[0.2em] uppercase text-white rounded-full transition-all duration-500 hover:shadow-lg hover:scale-105 active:scale-95 overflow-hidden"
              style={{ backgroundColor: primaryColor }}
              data-testid="button-rsvp"
            >
              <span className="relative z-10 flex items-center gap-2">
                <Heart className="w-3.5 h-3.5 group-hover:scale-110 transition-transform duration-500" />
                {rsvpButtonText}
              </span>
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
              />
            </button>

            <p className="font-serif-elegant text-base text-gray-600 mt-5 italic tracking-wide">
              {lp.rsvpSubtext || 'Please RSVP at your earliest convenience'}
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-10 bg-white border-t border-gray-50">
        <div className="text-center">
          <div className="flex items-center justify-center gap-3 mb-3">
            <div className="h-px w-10" style={{ background: `linear-gradient(90deg, transparent, ${accentColor}30)` }} />
            <Heart className="w-3 h-3" style={{ color: `${accentColor}50` }} />
            <div className="h-px w-10" style={{ background: `linear-gradient(270deg, transparent, ${accentColor}30)` }} />
          </div>
          <p className="font-sans-clean text-[9px] tracking-[0.4em] uppercase text-gray-400">
            {footerMessage}
          </p>
        </div>
      </footer>
    </div>
  );
}

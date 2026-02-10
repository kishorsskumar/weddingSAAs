import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronRight, ChevronLeft, Sparkles, CheckCircle2, LayoutDashboard, Calendar, Target, Receipt, Users, Package, Shield, BookOpen, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  target?: string;
  icon: any;
  position: "center" | "right" | "bottom-right" | "left";
  highlight?: string;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "welcome",
    title: "Welcome to Your Workspace!",
    description: "Let's take a quick tour of your platform. We'll show you the key areas so you can get started right away. This will only take a minute.",
    icon: Sparkles,
    position: "center",
  },
  {
    id: "sidebar",
    title: "Navigation Sidebar",
    description: "This is your main menu. All sections of the app are organized here — just click to expand any category and access its sub-pages.",
    icon: LayoutDashboard,
    position: "right",
    target: "[data-testid='nav-dashboard']",
    highlight: "sidebar",
  },
  {
    id: "events",
    title: "Event Hub",
    description: "Manage all your events here — create new events, view the calendar, set up timelines, and track execution plans. This is your central event control center.",
    icon: Calendar,
    position: "right",
    target: "[data-testid='nav-event-hub']",
  },
  {
    id: "sales",
    title: "Sales & Leads",
    description: "Track your leads, manage your sales pipeline, create estimates, and monitor conversion rates. Turn inquiries into bookings efficiently.",
    icon: Target,
    position: "right",
    target: "[data-testid='nav-sales']",
  },
  {
    id: "finance",
    title: "Finance & Accounting",
    description: "Handle invoices, estimates, payments, and your day book. Everything you need to keep your finances organized and professional.",
    icon: Receipt,
    position: "right",
    target: "[data-testid='nav-finance']",
  },
  {
    id: "operations",
    title: "Operations",
    description: "Manage inventory, purchase orders, production planning, rentals, transportation, and manpower — all the logistics for smooth event execution.",
    icon: Package,
    position: "right",
    target: "[data-testid='nav-operations']",
  },
  {
    id: "people",
    title: "People & Team",
    description: "Your HR hub — manage employees, track attendance, handle leave requests, and coordinate your team's schedule.",
    icon: Users,
    position: "right",
    target: "[data-testid='nav-people']",
  },
  {
    id: "notifications",
    title: "Stay Updated",
    description: "Click the bell icon to see your notifications — payment alerts, team updates, and important reminders all show up here.",
    icon: HelpCircle,
    position: "left",
    target: "[data-testid='button-notifications']",
  },
  {
    id: "done",
    title: "You're All Set!",
    description: "That's the quick tour! You can always restart this tutorial from the sidebar. Now go ahead and explore — start by creating your first event or adding a lead.",
    icon: CheckCircle2,
    position: "center",
  },
];

const TUTORIAL_KEY = "atbott_tutorial_completed";
const TUTORIAL_DISMISSED_KEY = "atbott_tutorial_dismissed";

const PAGES_WITH_OWN_SIDEBAR = ["/oak-book", "/oak-sales", "/oak-inventory"];

export function useTutorial() {
  const [isActive, setIsActive] = useState(false);
  const [location, navigate] = useLocation();
  const [hasCompleted, setHasCompleted] = useState(() => {
    return localStorage.getItem(TUTORIAL_KEY) === "true";
  });

  const startTutorial = useCallback(() => {
    if (PAGES_WITH_OWN_SIDEBAR.some(p => location.startsWith(p))) {
      navigate("/dashboard");
      setTimeout(() => setIsActive(true), 500);
    } else {
      setIsActive(true);
    }
  }, [location, navigate]);

  const completeTutorial = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, "true");
    setHasCompleted(true);
    setIsActive(false);
  }, []);

  const dismissTutorial = useCallback(() => {
    localStorage.setItem(TUTORIAL_DISMISSED_KEY, "true");
    setIsActive(false);
  }, []);

  useEffect(() => {
    const completed = localStorage.getItem(TUTORIAL_KEY) === "true";
    const dismissed = localStorage.getItem(TUTORIAL_DISMISSED_KEY) === "true";
    if (!completed && !dismissed) {
      const timer = setTimeout(() => {
        if (PAGES_WITH_OWN_SIDEBAR.some(p => location.startsWith(p))) {
          navigate("/dashboard");
          setTimeout(() => setIsActive(true), 500);
        } else {
          setIsActive(true);
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  return { isActive, hasCompleted, startTutorial, completeTutorial, dismissTutorial };
}

interface InteractiveTutorialProps {
  isActive: boolean;
  onComplete: () => void;
  onDismiss: () => void;
}

export function InteractiveTutorial({ isActive, onComplete, onDismiss }: InteractiveTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const step = TUTORIAL_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TUTORIAL_STEPS.length - 1;
  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

  const findVisibleElement = useCallback((selector: string): Element | null => {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return el;
    }
    return null;
  }, []);

  useEffect(() => {
    if (!isActive) {
      setCurrentStep(0);
      setTargetRect(null);
      return;
    }

    if (step?.target) {
      const el = findVisibleElement(step.target);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => {
          const rect = el.getBoundingClientRect();
          setTargetRect(rect);
        }, 300);
      } else {
        setTargetRect(null);
      }
    } else {
      setTargetRect(null);
    }
  }, [currentStep, isActive, step, findVisibleElement]);

  useEffect(() => {
    if (!isActive) return;
    const handleResize = () => {
      if (step?.target) {
        const el = findVisibleElement(step.target);
        if (el) setTargetRect(el.getBoundingClientRect());
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isActive, step, findVisibleElement]);

  const handleNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) setCurrentStep((s) => s - 1);
  };

  const handleSkip = () => {
    onDismiss();
  };

  useEffect(() => {
    if (!isActive) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleSkip();
      if (e.key === "ArrowRight" || e.key === "Enter") handleNext();
      if (e.key === "ArrowLeft") handlePrev();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isActive, currentStep]);

  if (!isActive) return null;

  const Icon = step.icon;

  const getTooltipPosition = (): React.CSSProperties => {
    if (step.position === "center" || !targetRect) {
      return {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
      };
    }
    if (step.position === "right") {
      return {
        top: Math.max(16, Math.min(targetRect.top - 20, window.innerHeight - 320)),
        left: Math.min(targetRect.right + 20, window.innerWidth - 420),
      };
    }
    if (step.position === "left") {
      return {
        top: Math.max(16, Math.min(targetRect.top - 20, window.innerHeight - 320)),
        right: window.innerWidth - targetRect.left + 20,
      };
    }
    return {
      top: targetRect.bottom + 16,
      left: Math.max(16, targetRect.left - 100),
    };
  };

  const spotlightPadding = 8;

  return (
    <AnimatePresence>
      <motion.div
        ref={overlayRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed inset-0 z-[9999]"
        data-testid="tutorial-overlay"
      >
        <svg
          className="absolute inset-0 w-full h-full"
          style={{ pointerEvents: "none" }}
        >
          <defs>
            <mask id="tutorial-mask">
              <rect width="100%" height="100%" fill="white" />
              {targetRect && (
                <rect
                  x={targetRect.left - spotlightPadding}
                  y={targetRect.top - spotlightPadding}
                  width={targetRect.width + spotlightPadding * 2}
                  height={targetRect.height + spotlightPadding * 2}
                  rx="8"
                  fill="black"
                />
              )}
            </mask>
          </defs>
          <rect
            width="100%"
            height="100%"
            fill="rgba(0,0,0,0.6)"
            mask="url(#tutorial-mask)"
            style={{ pointerEvents: "auto" }}
            onClick={(e) => e.stopPropagation()}
          />
        </svg>

        {targetRect && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute pointer-events-none"
            style={{
              left: targetRect.left - spotlightPadding,
              top: targetRect.top - spotlightPadding,
              width: targetRect.width + spotlightPadding * 2,
              height: targetRect.height + spotlightPadding * 2,
              borderRadius: 8,
              boxShadow: "0 0 0 3px #2FA4BC, 0 0 20px rgba(47,164,188,0.4)",
            }}
          />
        )}

        <motion.div
          key={step.id}
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            "absolute bg-white rounded-xl shadow-2xl border border-gray-200 w-[380px] max-w-[calc(100vw-32px)]",
            "z-[10000]"
          )}
          style={getTooltipPosition()}
          data-testid={`tutorial-step-${step.id}`}
        >
          <div className="relative">
            <div className="h-1 bg-gray-100 rounded-t-xl overflow-hidden">
              <motion.div
                className="h-full bg-[#2FA4BC]"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>

            <div className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 rounded-lg bg-[#2FA4BC]/10 shrink-0">
                  <Icon className="h-5 w-5 text-[#2FA4BC]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-base text-gray-900">{step.title}</h3>
                    <button
                      onClick={handleSkip}
                      className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors shrink-0 ml-2"
                      data-testid="tutorial-skip"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">
                    Step {currentStep + 1} of {TUTORIAL_STEPS.length}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-600 leading-relaxed mb-4">
                {step.description}
              </p>

              <div className="flex items-center justify-between">
                <div className="flex gap-1.5">
                  {TUTORIAL_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        i === currentStep
                          ? "w-6 bg-[#2FA4BC]"
                          : i < currentStep
                          ? "w-1.5 bg-[#2FA4BC]/40"
                          : "w-1.5 bg-gray-200"
                      )}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {!isFirst && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handlePrev}
                      className="h-8 px-3 text-gray-600"
                      data-testid="tutorial-prev"
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                  )}
                  {!isLast && !isFirst && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSkip}
                      className="h-8 px-3 text-gray-400 hover:text-gray-600"
                      data-testid="tutorial-skip-btn"
                    >
                      Skip
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={handleNext}
                    className="h-8 px-4 bg-[#2FA4BC] hover:bg-[#2590a6] text-white"
                    data-testid="tutorial-next"
                  >
                    {isFirst ? "Let's Go!" : isLast ? "Finish" : "Next"}
                    {!isLast && <ChevronRight className="h-4 w-4 ml-1" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function TutorialTriggerButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors text-sidebar-foreground/70 hover:bg-sidebar-accent"
      data-testid="button-restart-tutorial"
    >
      <HelpCircle className="h-4 w-4 text-sidebar-foreground/60" />
      <span>Platform Tour</span>
    </button>
  );
}

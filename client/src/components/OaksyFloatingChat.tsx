import { useState, useRef, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, X, Loader2, Sparkles, Mic, MicOff, ImagePlus, HelpCircle, ChevronRight } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

const PAGE_SUGGESTIONS: Record<string, { label: string; suggestions: string[] }> = {
  "/dashboard": {
    label: "Dashboard",
    suggestions: [
      "What events do we have this month?",
      "Show me today's financial summary",
      "How many upcoming events are booked?",
      "What's our total sales this year?",
    ],
  },
  "/event-calendar": {
    label: "Event Calendar",
    suggestions: [
      "What events are happening this week?",
      "Create a new wedding event",
      "Show events for next month",
      "What's our sales summary?",
    ],
  },
  "/event-database": {
    label: "Event Database",
    suggestions: [
      "Search for events by customer name",
      "Create a new event booking",
      "What's our total booked sales?",
      "Show me pending events",
    ],
  },
  "/team-calendar": {
    label: "Team Calendar",
    suggestions: [
      "Schedule a team meeting tomorrow at 10 AM",
      "What meetings are coming up this week?",
      "Create a client meeting",
      "Update tomorrow's meeting time",
    ],
  },
  "/daybook": {
    label: "Daybook",
    suggestions: [
      "Record an expense of ₹5000 for catering",
      "Show today's income entries",
      "Transfer ₹10000 from SBI to HDFC",
      "What's our total income this month?",
    ],
  },
  "/oak-book": {
    label: "Oak Book",
    suggestions: [
      "Create an estimate for a wedding",
      "Generate an invoice from estimate",
      "Show me the financial summary",
      "Record a new expense entry",
    ],
  },
  "/oak-sales": {
    label: "Oak Sales",
    suggestions: [
      "Create a new sales lead",
      "What's our sales pipeline status?",
      "Generate a smart estimate",
      "Show sales summary by planner",
    ],
  },
  "/hr": {
    label: "HR",
    suggestions: [
      "Check leave balance for all employees",
      "How many leaves does Femina have left?",
      "Show pending leave requests",
      "Add a new employee",
    ],
  },
  "/admin": {
    label: "Admin",
    suggestions: [
      "Show all system users",
      "Create a new user account",
      "View employee list",
      "What's the overall sales summary?",
    ],
  },
  "/management-mis": {
    label: "Management MIS",
    suggestions: [
      "Give me a full business analysis for this fiscal year",
      "How is our revenue trending compared to last year?",
      "Which planner is performing best this quarter?",
      "Analyze our cash flow and receivables aging",
    ],
  },
};

const GENERAL_SUGGESTIONS = [
  "What can you help me with?",
  "Show upcoming events",
  "What's our financial summary?",
  "Help me create an estimate",
];

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  imageUrl?: string;
}

interface Conversation {
  id: string;
  messages?: Message[];
}

export function OaksyFloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputMessage, setInputMessage] = useState("");
  const [conversationId, setConversationId] = useState<string | null>(() => {
    try { return sessionStorage.getItem("oaksy_floating_conv_id"); } catch { return null; }
  });
  const [isRecording, setIsRecording] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState<string | null>(null);
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setIsOpen(true);
      if (e.detail?.message) {
        setPendingMessage(e.detail.message);
      }
    };
    window.addEventListener("openOaksyChat", handler as EventListener);
    return () => window.removeEventListener("openOaksyChat", handler as EventListener);
  }, []);

  const matchedPage = Object.keys(PAGE_SUGGESTIONS).find(
    (path) => location === path || location.startsWith(path + "/")
  );
  const currentPageConfig = matchedPage ? PAGE_SUGGESTIONS[matchedPage] : null;
  const contextSuggestions = currentPageConfig?.suggestions || GENERAL_SUGGESTIONS;
  const contextLabel = currentPageConfig?.label || "General";

  const { data: allConversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/oaksy/conversations"],
    queryFn: async () => {
      const res = await fetch("/api/oaksy/conversations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!conversationId && allConversations.length > 0) {
      const latestId = allConversations[0].id;
      setConversationId(latestId);
      try { sessionStorage.setItem("oaksy_floating_conv_id", latestId); } catch {}
    }
  }, [allConversations, conversationId]);

  const { data: conversation } = useQuery<Conversation>({
    queryKey: ["/api/oaksy/conversations", conversationId],
    queryFn: async () => {
      if (!conversationId) return null;
      const res = await fetch(`/api/oaksy/conversations/${conversationId}`, { credentials: "include" });
      if (!res.ok) {
        try { sessionStorage.removeItem("oaksy_floating_conv_id"); } catch {}
        setConversationId(null);
        throw new Error("Failed");
      }
      return res.json();
    },
    enabled: !!conversationId && isOpen,
    retry: false,
  });

  const createConversationMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/oaksy/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ department: "general" }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      setConversationId(data.id);
      try { sessionStorage.setItem("oaksy_floating_conv_id", data.id); } catch {}
      queryClient.invalidateQueries({ queryKey: ["/api/oaksy/conversations"] });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ convId, content, image }: { convId: string; content: string; image?: string | null }) => {
      const res = await fetch(`/api/oaksy/conversations/${convId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content, inputType: image ? "image" : "text", image }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/oaksy/conversations", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/oaksy/conversations"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, conversation?.messages]);

  const handleSend = async () => {
    const hasContent = inputMessage.trim() || attachedImage;
    if (!hasContent || sendMessageMutation.isPending) return;

    const messageContent = inputMessage.trim() || (attachedImage ? "Please analyze this image" : "");
    const imageToSend = attachedImage;

    setInputMessage("");
    setAttachedImage(null);
    setAttachedImageName(null);

    if (!conversationId) {
      const newConv = await createConversationMutation.mutateAsync();
      await sendMessageMutation.mutateAsync({ convId: newConv.id, content: messageContent, image: imageToSend });
    } else {
      await sendMessageMutation.mutateAsync({ convId: conversationId, content: messageContent, image: imageToSend });
    }
  };

  useEffect(() => {
    if (pendingMessage && isOpen && !sendMessageMutation.isPending) {
      setPendingMessage(null);
      handleSuggestionClick(pendingMessage);
    }
  }, [pendingMessage, isOpen]);

  const handleSuggestionClick = async (suggestion: string) => {
    setShowAllSuggestions(false);
    setInputMessage("");
    setAttachedImage(null);
    setAttachedImageName(null);
    if (!conversationId) {
      const newConv = await createConversationMutation.mutateAsync();
      await sendMessageMutation.mutateAsync({ convId: newConv.id, content: suggestion });
    } else {
      await sendMessageMutation.mutateAsync({ convId: conversationId, content: suggestion });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        if (file.size > 10 * 1024 * 1024) {
          toast({ title: "File too large", description: "Please paste an image under 10MB", variant: "destructive" });
          return;
        }

        const reader = new FileReader();
        reader.onload = () => {
          setAttachedImage(reader.result as string);
          setAttachedImageName("Pasted image");
        };
        reader.readAsDataURL(file);
        return;
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please select an image under 10MB", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImage(reader.result as string);
      setAttachedImageName(file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const toggleRecording = () => {
    if (!isRecording) {
      if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
        toast({ title: "Not Supported", description: "Voice input not supported", variant: "destructive" });
        return;
      }
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN";
      recognition.onresult = (event: any) => {
        setInputMessage(prev => prev + " " + event.results[0][0].transcript);
        setIsRecording(false);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognition.start();
      setIsRecording(true);
    } else {
      setIsRecording(false);
    }
  };

  const messages = conversation?.messages || [];

  if (!user) return null;

  return (
    <>
      {isOpen && (
        <div className="fixed bottom-20 right-2 left-2 sm:left-auto md:bottom-24 md:right-6 sm:w-[380px] h-[calc(100dvh-10rem)] max-h-[500px] bg-white rounded-2xl shadow-2xl border border-gray-200 z-[9999] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200" data-testid="oaksy-floating-chat">
          <div className="flex items-center justify-between px-4 py-3 bg-[#4b7c29] text-white rounded-t-2xl">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold">Oaksy AI</p>
                <p className="text-[10px] opacity-80">Your smart assistant</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setIsOpen(false); setLocation('/oaksy-help'); }}
                className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
                title="Oaksy Help Guide"
                data-testid="button-oaksy-help"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
                data-testid="button-close-oaksy-chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-gray-50">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center px-3">
                <div className="w-12 h-12 rounded-full bg-[#4b7c29]/10 flex items-center justify-center mb-2">
                  <Sparkles className="w-6 h-6 text-[#4b7c29]" />
                </div>
                <p className="text-sm font-medium text-gray-700">Hi, I'm Oaksy!</p>
                <p className="text-[11px] text-gray-500 mt-1 mb-3">Your AI assistant</p>

                <div className="w-full space-y-1.5">
                  <div className="flex items-center gap-1.5 px-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#4b7c29]" />
                    <p className="text-[11px] font-medium text-gray-600">
                      {currentPageConfig ? `Try these on ${contextLabel}` : "Try asking me"}
                    </p>
                  </div>
                  {contextSuggestions.slice(0, showAllSuggestions ? 4 : 3).map((suggestion, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(suggestion)}
                      disabled={sendMessageMutation.isPending || createConversationMutation.isPending}
                      className="w-full text-left px-3 py-2 rounded-xl bg-white border border-gray-200 hover:border-[#4b7c29]/40 hover:bg-[#4b7c29]/5 transition-all text-[12px] text-gray-700 flex items-center gap-2 group disabled:opacity-50"
                      data-testid={`suggestion-chip-${i}`}
                    >
                      <ChevronRight className="w-3 h-3 text-gray-400 group-hover:text-[#4b7c29] transition-colors flex-shrink-0" />
                      <span className="truncate">{suggestion}</span>
                    </button>
                  ))}
                  {!showAllSuggestions && contextSuggestions.length > 3 && (
                    <button
                      onClick={() => setShowAllSuggestions(true)}
                      className="w-full text-center text-[11px] text-[#4b7c29] hover:underline py-1"
                    >
                      +{contextSuggestions.length - 3} more suggestion{contextSuggestions.length - 3 > 1 ? 's' : ''}
                    </button>
                  )}
                </div>

                <p className="text-[10px] text-gray-400 mt-3">You can also use voice input or attach images</p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[85%] px-3 py-2 rounded-2xl text-sm",
                    msg.role === "user"
                      ? "bg-[#4b7c29] text-white rounded-br-md"
                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-md shadow-sm"
                  )}
                >
                  {(msg as any).metadata?.hasImage && (
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs opacity-80">
                      <ImagePlus className="w-3.5 h-3.5" />
                      <span>Image attached</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{msg.content}</div>
                </div>
              </div>
            ))}
            {(sendMessageMutation.isPending || createConversationMutation.isPending) && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-[#4b7c29]" />
                    <span className="text-xs text-gray-500">Oaksy is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-3 py-3 bg-white border-t border-gray-100">
            {attachedImage && (
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className="relative">
                  <img src={attachedImage} alt="Attached" className="w-12 h-12 rounded-lg object-cover border border-gray-200" />
                  <button
                    onClick={() => { setAttachedImage(null); setAttachedImageName(null); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center"
                    data-testid="button-remove-image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-xs text-gray-500 truncate flex-1">{attachedImageName}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors bg-gray-100 text-gray-500 hover:bg-gray-200"
                disabled={sendMessageMutation.isPending}
                data-testid="button-oaksy-image"
              >
                <ImagePlus className="w-4 h-4" />
              </button>
              <button
                onClick={toggleRecording}
                className={cn(
                  "w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
                  isRecording ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                )}
                data-testid="button-oaksy-voice"
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <input
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                onPaste={handlePaste}
                placeholder={attachedImage ? "Describe what to do..." : "Ask Oaksy..."}
                className="flex-1 text-sm border border-gray-200 rounded-full px-4 py-2 focus:outline-none focus:border-[#4b7c29] focus:ring-1 focus:ring-[#4b7c29]/30"
                disabled={sendMessageMutation.isPending}
                data-testid="input-oaksy-message"
              />
              <button
                onClick={handleSend}
                disabled={(!inputMessage.trim() && !attachedImage) || sendMessageMutation.isPending}
                className="w-9 h-9 rounded-full bg-[#4b7c29] text-white flex items-center justify-center shrink-0 hover:bg-[#3d6622] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                data-testid="button-oaksy-send"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "fixed bottom-[4.5rem] right-4 md:bottom-6 md:right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center z-[9999] transition-all duration-200 hover:scale-105",
          isOpen ? "bg-gray-700 hover:bg-gray-800" : "bg-[#4b7c29] hover:bg-[#3d6622]"
        )}
        data-testid="button-oaksy-floating"
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <Sparkles className="w-6 h-6 text-white" />
        )}
      </button>
    </>
  );
}

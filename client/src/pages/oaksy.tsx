import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { 
  MessageSquare, 
  Plus, 
  Send, 
  Trash2, 
  Loader2,
  Mic,
  MicOff,
  Sparkles,
  TreeDeciduous,
  CheckCircle2,
  FileText,
  Calendar,
  Users,
  Download,
  ArrowLeft,
  ChevronRight,
  Eye,
  PlusCircle,
  Pencil,
  BarChart3,
  IndianRupee,
  Building2,
  UserCheck,
  ClipboardList,
  Receipt,
  Image,
  MessageCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/auth-context";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface CapabilityCategory {
  title: string;
  icon: React.ReactNode;
  color: string;
  items: string[];
  suggestions: string[];
  roles?: string[];
}

const OAKSY_CAPABILITIES: CapabilityCategory[] = [
  {
    title: "Events & Calendar",
    icon: <Calendar className="w-4 h-4" />,
    color: "bg-blue-50 text-blue-700 border-blue-200",
    items: [
      "View, search, and filter events",
      "Create new event bookings",
      "Update event details and status",
      "Check upcoming schedule",
    ],
    suggestions: [
      "What events do we have this month?",
      "Create a wedding event for next Saturday",
      "Show me all corporate events",
      "What's coming up this week?",
    ],
  },
  {
    title: "Finance & Daybook",
    icon: <IndianRupee className="w-4 h-4" />,
    color: "bg-green-50 text-green-700 border-green-200",
    items: [
      "Record income and expense entries",
      "Transfer between bank accounts",
      "View financial summaries",
      "Track sales figures and revenue",
    ],
    suggestions: [
      "Record an expense of ₹5000 for flowers",
      "What's our total income this month?",
      "Transfer ₹10000 from SBI to HDFC",
      "Show me today's daybook entries",
    ],
  },
  {
    title: "Estimates & Invoices",
    icon: <Receipt className="w-4 h-4" />,
    color: "bg-purple-50 text-purple-700 border-purple-200",
    items: [
      "Generate smart estimates from event details",
      "Create detailed estimates and invoices",
      "View sales pipeline and summaries",
    ],
    suggestions: [
      "Generate an estimate for a 200-guest wedding",
      "What's our total booked sales this year?",
      "Show sales summary by planner",
    ],
  },
  {
    title: "Team & Meetings",
    icon: <Users className="w-4 h-4" />,
    color: "bg-orange-50 text-orange-700 border-orange-200",
    items: [
      "Schedule and manage meetings",
      "View team calendar",
      "Update meeting details",
    ],
    suggestions: [
      "Schedule a client meeting tomorrow at 3 PM",
      "What meetings do we have this week?",
      "Create a team sync meeting",
    ],
  },
  {
    title: "HR & Leave",
    icon: <UserCheck className="w-4 h-4" />,
    color: "bg-pink-50 text-pink-700 border-pink-200",
    items: [
      "Check employee leave balances",
      "View and manage leave requests",
      "Add new employees",
      "Send salary slips via WhatsApp",
    ],
    suggestions: [
      "Check leave balance for all employees",
      "Show pending leave requests",
      "How many leaves does Femina have left?",
    ],
    roles: ["superadmin", "admin", "manager"],
  },
  {
    title: "Admin & Users",
    icon: <Building2 className="w-4 h-4" />,
    color: "bg-gray-50 text-gray-700 border-gray-200",
    items: [
      "View and manage system users",
      "Create new user accounts",
      "View overall system data",
    ],
    suggestions: [
      "Show all system users",
      "Create a new user account",
    ],
    roles: ["superadmin", "admin"],
  },
];

const QUICK_START_SUGGESTIONS: { text: string; icon: React.ReactNode; roles?: string[] }[] = [
  { text: "What can you help me with?", icon: <Sparkles className="w-3.5 h-3.5" /> },
  { text: "Show upcoming events this month", icon: <Calendar className="w-3.5 h-3.5" /> },
  { text: "What's our financial summary?", icon: <BarChart3 className="w-3.5 h-3.5" /> },
  { text: "Check pending leave requests", icon: <ClipboardList className="w-3.5 h-3.5" />, roles: ["superadmin", "admin", "manager"] },
  { text: "Create a new event booking", icon: <PlusCircle className="w-3.5 h-3.5" /> },
  { text: "Show sales summary by planner", icon: <IndianRupee className="w-3.5 h-3.5" />, roles: ["superadmin", "admin", "wedding_planner"] },
];

interface OaksyAction {
  type: string;
  data: any;
  success: boolean;
  message: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  inputType?: string;
  metadata?: { actions?: OaksyAction[] };
  createdAt: string;
}

interface Conversation {
  id: string;
  userId: string;
  title: string | null;
  department: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
}

const DEPARTMENTS = [
  { value: "general", label: "General", color: "bg-gray-500" },
  { value: "sales", label: "Sales", color: "bg-blue-500" },
  { value: "wedding_planning", label: "Wedding Planning", color: "bg-pink-500" },
  { value: "operations", label: "Operations", color: "bg-orange-500" },
  { value: "accounts", label: "Accounts", color: "bg-green-500" },
];

export default function OaksyPage() {
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("general");
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isSuperAdmin = user?.role === 'superadmin';

  const { data: conversations = [], isLoading: loadingConversations } = useQuery<Conversation[]>({
    queryKey: ["/api/oaksy/conversations"],
    queryFn: async () => {
      const res = await fetch("/api/oaksy/conversations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
  });

  const { data: activeConversation, isLoading: loadingMessages } = useQuery<Conversation>({
    queryKey: ["/api/oaksy/conversations", activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return null;
      const res = await fetch(`/api/oaksy/conversations/${activeConversationId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch conversation");
      return res.json();
    },
    enabled: !!activeConversationId,
  });

  const createConversationMutation = useMutation({
    mutationFn: async (department: string) => {
      const res = await fetch("/api/oaksy/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ department }),
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/oaksy/conversations"] });
      setActiveConversationId(data.id);
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create conversation", variant: "destructive" });
    },
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/oaksy/conversations/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete conversation");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/oaksy/conversations"] });
      if (activeConversationId === deleteConversationMutation.variables) {
        setActiveConversationId(null);
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to delete conversation", variant: "destructive" });
    },
  });

  const clearAllHistoryMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/oaksy/conversations", {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to clear history");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/oaksy/conversations"] });
      setActiveConversationId(null);
      toast({ 
        title: "History Cleared", 
        description: `Deleted ${data.deletedCount} conversation(s)` 
      });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to clear history", variant: "destructive" });
    },
  });

  const sendMessageMutation = useMutation({
    mutationFn: async ({ conversationId, content, inputType }: { conversationId: string; content: string; inputType?: string }) => {
      const res = await fetch(`/api/oaksy/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ content, inputType }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/oaksy/conversations", activeConversationId] });
      queryClient.invalidateQueries({ queryKey: ["/api/oaksy/conversations"] });
      setInputMessage("");
      
      if (data.actions && data.actions.length > 0) {
        const successActions = data.actions.filter((a: any) => a.success);
        if (successActions.length > 0) {
          toast({
            title: "Action Completed",
            description: successActions.map((a: any) => a.message).join('\n'),
          });
        }
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send message", variant: "destructive" });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeConversation?.messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    
    if (!activeConversationId) {
      const newConv = await createConversationMutation.mutateAsync(selectedDepartment);
      await sendMessageMutation.mutateAsync({
        conversationId: newConv.id,
        content: inputMessage,
        inputType: "text",
      });
    } else {
      await sendMessageMutation.mutateAsync({
        conversationId: activeConversationId,
        content: inputMessage,
        inputType: "text",
      });
    }
  };

  const handleSuggestionClick = async (text: string) => {
    setInputMessage("");
    if (!activeConversationId) {
      const newConv = await createConversationMutation.mutateAsync(selectedDepartment);
      await sendMessageMutation.mutateAsync({
        conversationId: newConv.id,
        content: text,
        inputType: "text",
      });
    } else {
      await sendMessageMutation.mutateAsync({
        conversationId: activeConversationId,
        content: text,
        inputType: "text",
      });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleNewConversation = () => {
    setActiveConversationId(null);
    setInputMessage("");
    inputRef.current?.focus();
  };

  const toggleRecording = () => {
    if (!isRecording) {
      if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
        toast({ title: "Not Supported", description: "Voice input is not supported in this browser", variant: "destructive" });
        return;
      }
      
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = "en-IN";
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputMessage(prev => prev + " " + transcript);
        setIsRecording(false);
      };
      
      recognition.onerror = () => {
        setIsRecording(false);
        toast({ title: "Error", description: "Voice recognition failed", variant: "destructive" });
      };
      
      recognition.onend = () => {
        setIsRecording(false);
      };
      
      recognition.start();
      setIsRecording(true);
    } else {
      setIsRecording(false);
    }
  };

  const getDepartmentBadge = (department: string | null) => {
    const dept = DEPARTMENTS.find(d => d.value === department) || DEPARTMENTS[0];
    return (
      <Badge variant="secondary" className={`${dept.color} text-white text-xs`}>
        {dept.label}
      </Badge>
    );
  };

  const messages = activeConversation?.messages || [];
  const isLoading = sendMessageMutation.isPending || createConversationMutation.isPending;

  return (
    <div className="h-[calc(100dvh-8rem)] md:h-[calc(100vh-4rem)] flex flex-col md:flex-row gap-0 md:gap-4 md:p-4 -mx-4 -mt-2 md:mx-0 md:mt-0" data-testid="oaksy-page">
      <Card className={cn(
        "w-full md:w-80 flex-shrink-0 flex flex-col rounded-none md:rounded-lg border-0 md:border",
        activeConversationId && "hidden md:flex"
      )}>
        <CardHeader className="pb-3 p-3 sm:p-6 sm:pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TreeDeciduous className="h-5 w-5 text-[#7C8B5D]" />
              Oaksy
            </CardTitle>
            <Button
              size="sm"
              onClick={handleNewConversation}
              className="bg-[#7C8B5D] hover:bg-[#6a7950] min-h-[44px] md:min-h-0"
              data-testid="button-new-conversation"
            >
              <Plus className="h-4 w-4 mr-1" />
              New
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-2">
          <ScrollArea className="h-full">
            {loadingConversations ? (
              <div className="flex items-center justify-center p-4" data-testid="status-loading-conversations">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center text-muted-foreground p-4 text-sm" data-testid="text-no-conversations">
                No conversations yet. Start a new chat!
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className={cn(
                      "group flex items-center gap-2 p-3 md:p-2 rounded-lg cursor-pointer hover:bg-muted transition-colors min-h-[56px] md:min-h-0",
                      activeConversationId === conv.id && "bg-muted"
                    )}
                    onClick={() => setActiveConversationId(conv.id)}
                    data-testid={`conversation-${conv.id}`}
                  >
                    <MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate" data-testid={`text-conversation-title-${conv.id}`}>
                        {conv.title || "New conversation"}
                      </div>
                      <div className="flex items-center gap-2">
                        {getDepartmentBadge(conv.department)}
                        <span className="text-xs text-muted-foreground" data-testid={`text-conversation-date-${conv.id}`}>
                          {format(new Date(conv.updatedAt), "MMM d")}
                        </span>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 md:h-6 md:w-6 opacity-100 md:opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversationMutation.mutate(conv.id);
                      }}
                      data-testid={`button-delete-${conv.id}`}
                    >
                      <Trash2 className="h-4 w-4 md:h-3 md:w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
        {isSuperAdmin && conversations.length > 0 && (
          <div className="p-2 border-t">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full text-destructive hover:text-destructive min-h-[44px]"
                  data-testid="button-clear-all-history"
                  disabled={clearAllHistoryMutation.isPending}
                >
                  {clearAllHistoryMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Clear All History
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear All Chat History</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all Oaksy conversations from all users. 
                    This action cannot be undone. Are you sure you want to continue?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => clearAllHistoryMutation.mutate()}
                  >
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </Card>

      <Card className={cn(
        "flex-1 flex flex-col rounded-none md:rounded-lg border-0 md:border",
        activeConversationId ? "fixed inset-0 bottom-16 z-40 md:relative md:inset-auto md:bottom-auto md:z-auto" : "hidden md:flex"
      )} data-testid="card-chat-main">
        <CardHeader className="pb-3 border-b p-3 sm:p-6 sm:pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden flex-shrink-0 min-h-[44px] min-w-[44px]"
                onClick={() => setActiveConversationId(null)}
                data-testid="button-back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-8 w-8 sm:h-10 sm:w-10 bg-[#9AAF6C] flex-shrink-0">
                <AvatarFallback className="bg-[#7C8B5D] text-white">
                  <Sparkles className="h-4 w-4 sm:h-5 sm:w-5" />
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <CardTitle className="text-base sm:text-lg truncate" data-testid="text-oaksy-title">Oaksy AI</CardTitle>
                <p className="text-xs sm:text-sm text-muted-foreground truncate" data-testid="text-oaksy-subtitle">
                  Event management assistant
                </p>
              </div>
            </div>
            {!activeConversationId && (
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-32 sm:w-48 min-h-[44px] sm:min-h-0" data-testid="select-department">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((dept) => (
                    <SelectItem key={dept.value} value={dept.value} data-testid={`select-department-${dept.value}`}>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${dept.color}`} />
                        {dept.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full p-4">
            {loadingMessages ? (
              <div className="flex items-center justify-center h-full" data-testid="status-loading-messages">
                <Loader2 className="h-8 w-8 animate-spin text-[#7C8B5D]" />
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col px-4 sm:px-8 py-4" data-testid="container-welcome">
                <div className="text-center mb-6">
                  <div className="w-16 h-16 rounded-full bg-[#4b7c29]/10 flex items-center justify-center mx-auto mb-3">
                    <TreeDeciduous className="h-8 w-8 text-[#4b7c29]" />
                  </div>
                  <h3 className="text-xl font-semibold mb-1" data-testid="text-welcome-title">Welcome to Oaksy!</h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto" data-testid="text-welcome-description">
                    I'm your AI assistant. I can help you manage events, finances, team, and more. Tap any suggestion below to get started!
                  </p>
                </div>

                <div className="mb-6">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">Quick Start</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2" data-testid="container-quick-start">
                    {QUICK_START_SUGGESTIONS.filter(item => !item.roles || item.roles.includes(user?.role || '')).map((item, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestionClick(item.text)}
                        disabled={isLoading}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white border border-gray-200 hover:border-[#4b7c29]/40 hover:bg-[#4b7c29]/5 transition-all text-sm text-left group disabled:opacity-50"
                        data-testid={`quick-start-${i}`}
                      >
                        <span className="text-gray-400 group-hover:text-[#4b7c29] transition-colors flex-shrink-0">{item.icon}</span>
                        <span className="text-gray-700 truncate">{item.text}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">What I Can Help With</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="container-capabilities">
                    {OAKSY_CAPABILITIES
                      .filter(cat => !cat.roles || cat.roles.includes(user?.role || ''))
                      .map((category, catIdx) => (
                        <div
                          key={catIdx}
                          className={`rounded-lg border p-3 ${category.color}`}
                          data-testid={`capability-card-${catIdx}`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            {category.icon}
                            <span className="text-sm font-semibold">{category.title}</span>
                          </div>
                          <ul className="space-y-1 mb-3">
                            {category.items.map((item, itemIdx) => (
                              <li key={itemIdx} className="text-xs flex items-start gap-1.5 opacity-80">
                                <CheckCircle2 className="w-3 h-3 mt-0.5 flex-shrink-0" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="space-y-1">
                            <p className="text-[10px] font-medium uppercase tracking-wider opacity-60">Try saying:</p>
                            {category.suggestions.slice(0, 2).map((suggestion, sIdx) => (
                              <button
                                key={sIdx}
                                onClick={() => handleSuggestionClick(suggestion)}
                                disabled={isLoading}
                                className="w-full text-left text-xs px-2 py-1.5 rounded-md bg-white/60 hover:bg-white transition-colors flex items-center gap-1.5 group disabled:opacity-50"
                                data-testid={`capability-suggestion-${catIdx}-${sIdx}`}
                              >
                                <ChevronRight className="w-3 h-3 opacity-40 group-hover:opacity-100 flex-shrink-0" />
                                <span className="truncate">"{suggestion}"</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>

                <div className="text-center mt-2 space-y-1">
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Mic className="w-3 h-3" /> Voice input</span>
                    <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> Natural language</span>
                    <span className="flex items-center gap-1"><Image className="w-3 h-3" /> Image analysis</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">Just type or speak naturally — Oaksy understands everyday language</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
                    data-testid={`message-${msg.id}`}
                  >
                    <Avatar className={`h-8 w-8 flex-shrink-0 ${msg.role === "assistant" ? "bg-[#7C8B5D]" : "bg-[#B8A44C]"}`}>
                      <AvatarFallback className="text-white text-xs">
                        {msg.role === "assistant" ? (
                          <Sparkles className="h-4 w-4" />
                        ) : (
                          "You"
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div
                      className={`max-w-[85%] sm:max-w-[75%] rounded-lg p-3 ${
                        msg.role === "user"
                          ? "bg-[#7C8B5D] text-white"
                          : "bg-muted"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap" data-testid={`text-message-content-${msg.id}`}>{msg.content}</p>
                      {msg.metadata?.actions && msg.metadata.actions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2" data-testid={`actions-${msg.id}`}>
                          {msg.metadata.actions.map((action, idx) => {
                            const isDocumentAction = action.type.startsWith('generate_') && action.success && action.data?.downloadUrl;
                            
                            if (isDocumentAction) {
                              return (
                                <a
                                  key={idx}
                                  href={action.data.downloadUrl}
                                  download={action.data.filename}
                                  className="inline-flex items-center gap-2 px-3 py-2 bg-[#8B5A2B] text-white rounded-lg hover:bg-[#6B4423] transition-colors text-sm font-medium"
                                  data-testid={`download-button-${msg.id}-${idx}`}
                                >
                                  <Download className="h-4 w-4" />
                                  Download {action.data.filename || 'Document'}
                                </a>
                              );
                            }
                            
                            return (
                              <Badge
                                key={idx}
                                variant={action.success ? "default" : "destructive"}
                                className={action.success ? "bg-[#9AAF6C] text-white" : ""}
                                data-testid={`action-badge-${msg.id}-${idx}`}
                              >
                                {action.success ? (
                                  <CheckCircle2 className="h-3 w-3 mr-1" />
                                ) : null}
                                {action.type === "create_daybook_entry" && "Entry Created"}
                                {action.type === "create_meeting" && "Meeting Scheduled"}
                                {action.type === "create_event" && "Event Created"}
                                {action.type === "create_bank_transfer" && "Transfer Created"}
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                      <p className={`text-xs mt-1 ${msg.role === "user" ? "text-white/70" : "text-muted-foreground"}`} data-testid={`text-message-time-${msg.id}`}>
                        {format(new Date(msg.createdAt), "h:mm a")}
                      </p>
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex gap-3" data-testid="status-loading-response">
                    <Avatar className="h-8 w-8 bg-[#7C8B5D]">
                      <AvatarFallback className="text-white">
                        <Sparkles className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="bg-muted rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>
        </CardContent>

        <div className="p-3 sm:p-4 border-t bg-background">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleRecording}
              className={cn(
                "min-h-[44px] min-w-[44px] flex-shrink-0",
                isRecording && "bg-red-100 border-red-500 text-red-500"
              )}
              data-testid="button-voice-input"
            >
              {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
            <Input
              ref={inputRef}
              placeholder="Ask Oaksy anything..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              className="flex-1 min-h-[44px]"
              disabled={isLoading}
              data-testid="input-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !inputMessage.trim()}
              className="bg-[#7C8B5D] hover:bg-[#6a7950] min-h-[44px] min-w-[44px]"
              data-testid="button-send"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

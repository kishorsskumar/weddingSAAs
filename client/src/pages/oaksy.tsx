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
  Download
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

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
  const queryClient = useQueryClient();

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
    <div className="h-[calc(100vh-4rem)] flex gap-4 p-4" data-testid="oaksy-page">
      <Card className="w-80 flex-shrink-0 flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <TreeDeciduous className="h-5 w-5 text-[#7C8B5D]" />
              Oaksy
            </CardTitle>
            <Button
              size="sm"
              onClick={handleNewConversation}
              className="bg-[#7C8B5D] hover:bg-[#6a7950]"
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
                    className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer hover:bg-muted transition-colors ${
                      activeConversationId === conv.id ? "bg-muted" : ""
                    }`}
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
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversationMutation.mutate(conv.id);
                      }}
                      data-testid={`button-delete-${conv.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col" data-testid="card-chat-main">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10 bg-[#9AAF6C]">
                <AvatarFallback className="bg-[#7C8B5D] text-white">
                  <Sparkles className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-lg" data-testid="text-oaksy-title">Oaksy AI Assistant</CardTitle>
                <p className="text-sm text-muted-foreground" data-testid="text-oaksy-subtitle">
                  Your helpful companion for event management
                </p>
              </div>
            </div>
            {!activeConversationId && (
              <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                <SelectTrigger className="w-48" data-testid="select-department">
                  <SelectValue placeholder="Select department" />
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
              <div className="flex flex-col items-center justify-center h-full text-center px-8" data-testid="container-welcome">
                <TreeDeciduous className="h-16 w-16 text-[#9AAF6C] mb-4" />
                <h3 className="text-xl font-semibold mb-2" data-testid="text-welcome-title">Welcome to Oaksy!</h3>
                <p className="text-muted-foreground mb-4 max-w-md" data-testid="text-welcome-description">
                  I'm your AI assistant for Oak Street Events. Ask me anything about events, 
                  financials, team management, or get help with your daily tasks.
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm" data-testid="container-suggestions">
                  <div className="p-3 bg-muted rounded-lg text-left" data-testid="card-suggestion-1">
                    <span className="font-medium">Try asking:</span>
                    <p className="text-muted-foreground">"What events do we have this month?"</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-left" data-testid="card-suggestion-2">
                    <span className="font-medium">Or:</span>
                    <p className="text-muted-foreground">"Help me plan a wedding timeline"</p>
                  </div>
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
                      className={`max-w-[75%] rounded-lg p-3 ${
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

        <div className="p-4 border-t">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={toggleRecording}
              className={isRecording ? "bg-red-100 border-red-500 text-red-500" : ""}
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
              disabled={isLoading}
              className="flex-1"
              data-testid="input-message"
            />
            <Button
              onClick={handleSendMessage}
              disabled={isLoading || !inputMessage.trim()}
              className="bg-[#7C8B5D] hover:bg-[#6a7950]"
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

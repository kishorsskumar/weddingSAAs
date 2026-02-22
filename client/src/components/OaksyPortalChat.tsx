import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMutation, useQuery } from '@tanstack/react-query';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface OaksyPortalChatProps {
  chatType: 'landing' | 'portal';
  portalToken?: string;
  clientName?: string;
  autoOpen?: boolean;
}

const OAK_GREEN = '#4b7c29';

export function OaksyPortalChat({ chatType, portalToken, clientName, autoOpen = false }: OaksyPortalChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasAutoOpened, setHasAutoOpened] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const [registrationLeadId, setRegistrationLeadId] = useState<number | null>(null);
  const [otpInput, setOtpInput] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem('oaksy_portal_session');
    if (stored) return stored;
    const newId = `portal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('oaksy_portal_session', newId);
    return newId;
  });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  useEffect(() => {
    if (autoOpen && !hasAutoOpened) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        setHasAutoOpened(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoOpen, hasAutoOpened]);

  const { data: chatHistory } = useQuery({
    queryKey: ['/api/portal-chat', sessionId, chatType],
    queryFn: async () => {
      const response = await fetch(`/api/portal-chat/${sessionId}?chatType=${chatType}`);
      if (!response.ok) throw new Error('Failed to fetch chat history');
      return response.json();
    },
    enabled: isOpen,
  });

  useEffect(() => {
    if (chatHistory?.messages && chatHistory.messages.length > 0) {
      setMessages(chatHistory.messages);
    }
  }, [chatHistory]);

  const sendMessageMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      const response = await fetch('/api/portal-chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          message: userMessage,
          chatType,
          portalToken
        })
      });
      if (!response.ok) throw new Error('Failed to send message');
      return response.json();
    },
    onSuccess: (data) => {
      setError(null);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString()
      }]);
      if (data.registration?.success) {
        setRegistrationComplete(true);
        setRegistrationLeadId(data.registration.leadId);
      }
      setTimeout(() => inputRef.current?.focus(), 50);
    },
    onError: () => {
      setError('Unable to send message. Please try again.');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  });

  const handleSend = () => {
    if (!message.trim() || sendMessageMutation.isPending) return;
    
    setError(null);
    const userMessage = message.trim();
    setMessage('');
    
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      timestamp: new Date().toISOString()
    }]);
    
    sendMessageMutation.mutate(userMessage);
    setTimeout(() => inputRef.current?.focus(), 10);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getWelcomeMessage = () => {
    if (chatType === 'portal' && clientName) {
      return `Hi ${clientName}! 👋 I'm Oaksy, your personal wedding planning assistant. How can I help you with your event today?`;
    }
    return "Hello! 👋 Welcome! I'm Oaksy, your personal wedding planning assistant. I'd love to help you plan your dream celebration! Are you planning a wedding or a special event?";
  };

  const formatMessage = (content: string) => {
    return content.split('\n').map((line, i) => (
      <React.Fragment key={i}>
        {line}
        {i < content.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 pl-4 pr-5 py-3.5 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
          style={{ backgroundColor: OAK_GREEN, color: 'white' }}
          data-testid="oaksy-chat-button"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 transition-transform duration-300 group-hover:rotate-12" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-300 rounded-full animate-pulse"></span>
          </div>
          <span className="font-medium text-sm">Chat with Oaksy</span>
        </button>
      )}

      {isOpen && (
        <div 
          className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ 
            height: 'min(520px, calc(100vh - 6rem))',
            border: `1.5px solid ${OAK_GREEN}30`,
          }}
        >
          <div 
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ background: `linear-gradient(135deg, ${OAK_GREEN}, #3d6621)` }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold text-sm">Oaksy</h3>
                <p className="text-white/70 text-xs">Wedding Planning Assistant</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
              data-testid="close-chat-button"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-green-50/30 to-white">
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex gap-2.5 items-start">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${OAK_GREEN}15` }}>
                    <Sparkles className="w-3.5 h-3.5" style={{ color: OAK_GREEN }} />
                  </div>
                  <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-gray-100 max-w-[85%]">
                    <p className="text-sm text-gray-700 leading-relaxed">{getWelcomeMessage()}</p>
                  </div>
                </div>
                {chatType === 'landing' && (
                  <div className="flex flex-wrap gap-2 ml-9">
                    {['Planning a wedding', 'Looking for decor', 'Need a quote'].map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => {
                          setMessage(suggestion);
                          setTimeout(() => {
                            setMessages(prev => [...prev, {
                              role: 'user',
                              content: suggestion,
                              timestamp: new Date().toISOString()
                            }]);
                            setMessage('');
                            sendMessageMutation.mutate(suggestion);
                          }, 100);
                        }}
                        className="text-xs px-3 py-1.5 rounded-full border transition-all duration-200 hover:scale-105"
                        style={{ 
                          borderColor: `${OAK_GREEN}40`,
                          color: OAK_GREEN,
                          backgroundColor: `${OAK_GREEN}08`
                        }}
                        data-testid={`suggestion-${suggestion.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'gap-2.5 items-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: `${OAK_GREEN}15` }}>
                    <Sparkles className="w-3.5 h-3.5" style={{ color: OAK_GREEN }} />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user' 
                      ? 'rounded-tr-md shadow-sm' 
                      : 'rounded-tl-md bg-white shadow-sm border border-gray-100'
                  }`}
                  style={msg.role === 'user' 
                    ? { backgroundColor: OAK_GREEN, color: 'white' } 
                    : { color: '#374151' }
                  }
                >
                  {formatMessage(msg.content)}
                </div>
              </div>
            ))}
            
            {sendMessageMutation.isPending && (
              <div className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${OAK_GREEN}15` }}>
                  <Sparkles className="w-3.5 h-3.5" style={{ color: OAK_GREEN }} />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-md px-4 py-3 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: OAK_GREEN, animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: OAK_GREEN, animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 rounded-full animate-bounce" style={{ backgroundColor: OAK_GREEN, animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}

            {registrationComplete && !otpVerified && registrationLeadId && (
              <div className="bg-green-50 rounded-xl px-3 py-3 border border-green-200 space-y-2">
                <div className="flex gap-2 items-center">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="text-xs text-green-700 font-medium">Registered! Verify your WhatsApp to complete.</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Enter 6-digit OTP"
                    className="flex-1 text-xs h-8 rounded-lg"
                    maxLength={6}
                    disabled={otpVerifying}
                    data-testid="otp-input"
                  />
                  <Button
                    size="sm"
                    className="h-8 text-xs px-3 rounded-lg"
                    style={{ backgroundColor: OAK_GREEN }}
                    disabled={otpInput.length !== 6 || otpVerifying}
                    onClick={async () => {
                      setOtpVerifying(true);
                      try {
                        const response = await fetch('/api/portal/verify-otp', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ leadId: registrationLeadId, otp: otpInput })
                        });
                        const data = await response.json();
                        if (response.ok) {
                          setOtpVerified(true);
                          setMessages(prev => [...prev, {
                            role: 'assistant',
                            content: "Your WhatsApp is verified! 🎉 You're all set. Our wedding planner will reach out to you very soon. Feel free to ask me anything in the meantime!",
                            timestamp: new Date().toISOString()
                          }]);
                        } else {
                          setError(data.error || 'Invalid OTP. Please try again.');
                        }
                      } catch {
                        setError('Failed to verify OTP. Please try again.');
                      }
                      setOtpVerifying(false);
                    }}
                    data-testid="verify-otp-button"
                  >
                    {otpVerifying ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Verify'}
                  </Button>
                </div>
              </div>
            )}
            
            {otpVerified && (
              <div className="flex gap-2 items-center bg-green-50 rounded-xl px-3 py-2 border border-green-200">
                <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-xs text-green-700 font-medium">Verified! A wedding planner will contact you soon.</span>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm p-2.5 rounded-xl bg-red-50 border border-red-100">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
                <span className="text-red-600 text-xs">{error}</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white border-t border-gray-100 shrink-0">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1 text-sm h-10 rounded-xl border-gray-200 focus-visible:ring-1"
                style={{ '--tw-ring-color': `${OAK_GREEN}40` } as any}
                disabled={sendMessageMutation.isPending}
                data-testid="chat-input"
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || sendMessageMutation.isPending}
                size="icon"
                className="shrink-0 h-10 w-10 rounded-xl hover:opacity-90 transition-opacity"
                style={{ backgroundColor: OAK_GREEN }}
                data-testid="send-message-button"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

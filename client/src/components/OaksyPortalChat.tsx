import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MessageCircle, X, Send, Loader2, AlertCircle } from 'lucide-react';
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
}

const OAK_GREEN = '#4b7c29';
const OAK_GREEN_LIGHT = '#5a9432';

export function OaksyPortalChat({ chatType, portalToken, clientName }: OaksyPortalChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
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
      inputRef.current.focus();
    }
  }, [isOpen]);

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
    },
    onError: () => {
      setError('Unable to send message. Please try again.');
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getWelcomeMessage = () => {
    if (chatType === 'portal' && clientName) {
      return `Hi ${clientName}! I'm Oaksy, your wedding planning assistant. How can I help you with your event today?`;
    }
    return "Hi there! I'm Oaksy, your friendly wedding planning assistant at Oakstreet Events. How can I help you today?";
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg hover:scale-105 transition-transform"
          style={{ backgroundColor: OAK_GREEN, color: 'white' }}
          data-testid="oaksy-chat-button"
        >
          <MessageCircle className="w-5 h-5" />
          <span className="font-medium">Chat with Oaksy</span>
        </button>
      )}

      {isOpen && (
        <div 
          className="fixed bottom-6 right-6 z-50 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          style={{ height: '480px', border: `2px solid ${OAK_GREEN}` }}
        >
          <div 
            className="flex items-center justify-between px-4 py-3"
            style={{ backgroundColor: OAK_GREEN }}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-white font-semibold">Oaksy</h3>
                <p className="text-white/80 text-xs">Wedding Planning Assistant</p>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-full hover:bg-white/20 transition-colors"
              data-testid="close-chat-button"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-white">
            {messages.length === 0 && (
              <div 
                className="bg-white rounded-lg p-3 shadow-sm border-l-4"
                style={{ borderLeftColor: OAK_GREEN, borderColor: OAK_GREEN }}
              >
                <p className="text-sm" style={{ color: OAK_GREEN }}>{getWelcomeMessage()}</p>
              </div>
            )}
            
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className="max-w-[85%] rounded-lg p-3 text-sm"
                  style={msg.role === 'user' 
                    ? { backgroundColor: OAK_GREEN, color: 'white' } 
                    : { backgroundColor: 'white', color: OAK_GREEN, border: `1px solid ${OAK_GREEN}` }
                  }
                >
                  {msg.content}
                </div>
              </div>
            ))}
            
            {sendMessageMutation.isPending && (
              <div className="flex justify-start">
                <div className="rounded-lg p-3" style={{ backgroundColor: 'white', border: `1px solid ${OAK_GREEN}` }}>
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: OAK_GREEN }} />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-sm p-2 rounded" style={{ color: OAK_GREEN, backgroundColor: `${OAK_GREEN}10` }}>
                <AlertCircle className="w-4 h-4" />
                <span>{error}</span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          <div className="p-3 bg-white" style={{ borderTop: `1px solid ${OAK_GREEN}30` }}>
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                className="flex-1 text-sm focus-visible:ring-1"
                style={{ borderColor: `${OAK_GREEN}50` }}
                disabled={sendMessageMutation.isPending}
                data-testid="chat-input"
              />
              <Button
                onClick={handleSend}
                disabled={!message.trim() || sendMessageMutation.isPending}
                size="icon"
                className="shrink-0 hover:opacity-90"
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

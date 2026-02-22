import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';

interface OaksyNotification {
  title: string;
  body: string;
  actionUrl?: string;
  notificationId?: string;
  type?: string;
}

export function OaksyNotificationToast() {
  const [notifications, setNotifications] = useState<OaksyNotification[]>([]);
  const [visible, setVisible] = useState<OaksyNotification | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const timeoutRef = useRef<NodeJS.Timeout>();

  const playSound = useCallback(() => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/oaksy-notification.wav');
        audioRef.current.volume = 0.5;
      }
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    } catch (e) {}
  }, []);

  const showNotification = useCallback((notification: OaksyNotification) => {
    setVisible(notification);
    playSound();

    queryClient.invalidateQueries({ queryKey: ['/api/notifications/unread-count'] });
    queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setVisible(null);
    }, 8000);
  }, [playSound, queryClient]);

  const dismiss = useCallback(() => {
    setVisible(null);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'OAKSY_NOTIFICATION') {
        const payload = event.data.payload;
        showNotification({
          title: payload.title || 'Oaksy',
          body: payload.body || payload.message || '',
          actionUrl: payload.actionUrl,
          notificationId: payload.notificationId,
          type: payload.type,
        });
      }
    };

    navigator.serviceWorker?.addEventListener('message', handler);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handler);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [showNotification]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[9999] animate-in slide-in-from-top-2 fade-in duration-300 max-w-[360px] w-full"
      data-testid="oaksy-notification-toast"
    >
      <div 
        className={`bg-white rounded-xl shadow-2xl border border-[#4b7c29]/20 overflow-hidden ${visible.actionUrl ? 'cursor-pointer' : ''}`}
        onClick={() => {
          if (visible.actionUrl) {
            navigate(visible.actionUrl);
            dismiss();
          }
        }}
      >
        <div className="bg-[#4b7c29] px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-xs font-bold">O</span>
            </div>
            <span className="text-white text-sm font-semibold">Oaksy</span>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            className="text-white/80 hover:text-white transition-colors"
            data-testid="button-dismiss-oaksy-toast"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          <p className="text-sm text-gray-800 leading-relaxed">{visible.body}</p>

          {visible.actionUrl && (
            <button
              onClick={() => {
                navigate(visible.actionUrl!);
                dismiss();
              }}
              className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[#4b7c29] hover:text-[#3d6622] transition-colors"
              data-testid="button-oaksy-toast-action"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Details
            </button>
          )}
        </div>

        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-[#4b7c29] animate-shrink-width"
            style={{ animationDuration: '8s' }}
          />
        </div>
      </div>
    </div>
  );
}

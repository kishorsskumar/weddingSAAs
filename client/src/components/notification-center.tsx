import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, X, Settings, Calendar, FileText, Receipt, Package, Users, AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useLocation } from "wouter";

interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  isRead: boolean;
  isDismissed: boolean;
  relatedEntityType?: string;
  relatedEntityId?: string;
  actionUrl?: string;
  createdAt: string;
}

interface NotificationPreference {
  id: string;
  userId: string;
  eventRemindersEnabled: boolean;
  eventReminderDays: number;
  invoiceDueRemindersEnabled: boolean;
  invoiceReminderDays: number;
  estimateDueRemindersEnabled: boolean;
  estimateReminderDays: number;
  leaveRequestNotificationsEnabled: boolean;
  productionDeadlineRemindersEnabled: boolean;
  productionReminderDays: number;
  emailNotificationsEnabled: boolean;
  dailyDigestEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  whatsappEnabled: boolean;
  whatsappPhoneNumber?: string;
}

const typeIcons: Record<string, React.ElementType> = {
  event_reminder: Calendar,
  invoice_due: Receipt,
  estimate_due: FileText,
  leave_request: Users,
  leave_approved: Check,
  leave_rejected: X,
  production_deadline: Package,
  system: AlertCircle,
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-800",
  normal: "bg-blue-50 text-blue-800",
  high: "bg-amber-50 text-amber-800 border-l-4 border-l-amber-500",
  urgent: "bg-red-50 text-red-800 border-l-4 border-l-red-500",
};

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: unreadCount = 0 } = useQuery<number>({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/unread-count", { credentials: "include" });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.count || 0;
    },
    refetchInterval: 30000,
  });

  const { 
    data: notifications = [], 
    isLoading: notificationsLoading,
    isError: notificationsError,
    refetch: refetchNotifications
  } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications?limit=20", { credentials: "include" });
      if (res.status === 401) {
        return [];
      }
      if (!res.ok) throw new Error("Failed to fetch notifications");
      return res.json();
    },
    enabled: isOpen,
    retry: 2,
    retryDelay: 1000,
  });

  const defaultPreferences: NotificationPreference = {
    id: '',
    userId: '',
    eventRemindersEnabled: true,
    eventReminderDays: 3,
    invoiceDueRemindersEnabled: true,
    invoiceReminderDays: 7,
    estimateDueRemindersEnabled: true,
    estimateReminderDays: 3,
    leaveRequestNotificationsEnabled: true,
    productionDeadlineRemindersEnabled: true,
    productionReminderDays: 2,
    emailNotificationsEnabled: false,
    dailyDigestEnabled: false,
    whatsappEnabled: false,
    whatsappPhoneNumber: undefined,
  };

  const { 
    data: preferences,
    isLoading: preferencesLoading,
    isError: preferencesError,
    refetch: refetchPreferences
  } = useQuery<NotificationPreference>({
    queryKey: ["/api/notification-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/notification-preferences", { credentials: "include" });
      if (res.status === 401) {
        return defaultPreferences;
      }
      if (!res.ok) throw new Error("Failed to fetch preferences");
      return res.json();
    },
    enabled: settingsOpen,
    retry: 2,
    retryDelay: 1000,
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "PATCH",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark notification as read", variant: "destructive" });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/mark-all-read", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to mark all as read");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({ title: "Done", description: "All notifications marked as read" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to mark all as read", variant: "destructive" });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to dismiss");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to dismiss notification", variant: "destructive" });
    },
  });

  const dismissAllMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/dismiss-all", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to dismiss all");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      toast({ title: "Done", description: "All notifications cleared" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to clear notifications", variant: "destructive" });
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/generate", {
        method: "POST",
        credentials: "include",
      });
      if (res.status === 401) {
        return { notificationsGenerated: 0, authRequired: true };
      }
      if (!res.ok) throw new Error("Failed to generate notifications");
      return res.json();
    },
    onSuccess: (data) => {
      if (data.authRequired) {
        toast({ title: "Sign in required", description: "Please sign in to check for notifications" });
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      if (data.notificationsGenerated > 0) {
        toast({ title: "Updated", description: `${data.notificationsGenerated} new notification(s) found` });
      } else {
        toast({ title: "Up to date", description: "No new notifications" });
      }
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to check for notifications", variant: "destructive" });
    },
  });

  const updatePreferencesMutation = useMutation({
    mutationFn: async (data: Partial<NotificationPreference>) => {
      const res = await fetch("/api/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notification-preferences"] });
      toast({ title: "Saved", description: "Notification preferences updated" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save preferences", variant: "destructive" });
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markAsReadMutation.mutate(notification.id);
    }
    if (notification.actionUrl) {
      navigate(notification.actionUrl);
      setIsOpen(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            data-testid="button-notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge 
                className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 text-xs bg-red-500 hover:bg-red-500"
                data-testid="notification-count"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 md:w-96 p-0" align="end">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold text-lg">Notifications</h3>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
                title="Check for new notifications"
                data-testid="button-refresh-notifications"
              >
                {generateMutation.isPending ? "..." : "Refresh"}
              </Button>
              <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" data-testid="button-notification-settings">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Notification Settings</DialogTitle>
                    <DialogDescription>
                      Customize when and how you receive notifications
                    </DialogDescription>
                  </DialogHeader>
                  <NotificationSettings
                    preferences={preferences}
                    onUpdate={(data) => updatePreferencesMutation.mutate(data)}
                    isUpdating={updatePreferencesMutation.isPending}
                    isLoading={preferencesLoading}
                    isError={preferencesError}
                    onRetry={() => refetchPreferences()}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {notifications.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/50">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
                data-testid="button-mark-all-read"
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => dismissAllMutation.mutate()}
                disabled={dismissAllMutation.isPending}
                data-testid="button-dismiss-all"
              >
                Clear all
              </Button>
            </div>
          )}

          <ScrollArea className="max-h-80">
            {notificationsLoading ? (
              <div className="p-8 text-center text-muted-foreground">
                <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin opacity-50" />
                <p className="text-sm">Loading notifications...</p>
              </div>
            ) : notificationsError ? (
              <div className="p-8 text-center text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-400" />
                <p className="text-sm text-red-600">Failed to load notifications</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => refetchNotifications()}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Try again
                </Button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No notifications yet</p>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={() => generateMutation.mutate()}
                >
                  Check for updates
                </Button>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification) => {
                  const Icon = typeIcons[notification.type] || Bell;
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        "p-4 cursor-pointer hover:bg-muted/50 transition-colors",
                        priorityColors[notification.priority] || priorityColors.normal,
                        !notification.isRead && "bg-blue-50/50"
                      )}
                      onClick={() => handleNotificationClick(notification)}
                      data-testid={`notification-${notification.id}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "p-2 rounded-full shrink-0",
                          notification.priority === "high" || notification.priority === "urgent"
                            ? "bg-amber-100"
                            : "bg-muted"
                        )}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn(
                              "text-sm font-medium truncate",
                              !notification.isRead && "font-semibold"
                            )}>
                              {notification.title}
                            </p>
                            {!notification.isRead && (
                              <div className="h-2 w-2 bg-blue-500 rounded-full shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0 h-6 w-6"
                          onClick={(e) => {
                            e.stopPropagation();
                            dismissMutation.mutate(notification.id);
                          }}
                          data-testid={`dismiss-notification-${notification.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function NotificationSettings({
  preferences,
  onUpdate,
  isUpdating,
  isLoading,
  isError,
  onRetry,
}: {
  preferences?: NotificationPreference;
  onUpdate: (data: Partial<NotificationPreference>) => void;
  isUpdating: boolean;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
}) {
  if (isLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Loader2 className="h-6 w-6 mx-auto mb-2 animate-spin" />
        <p className="text-sm">Loading preferences...</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-400" />
        <p className="text-sm text-red-600">Failed to load preferences</p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Try again
          </Button>
        )}
      </div>
    );
  }

  if (!preferences) {
    return <div className="py-4 text-center text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="space-y-6 py-4">
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Event Reminders</h4>
        <div className="flex items-center justify-between">
          <Label htmlFor="event-reminders" className="text-sm">
            Enable event reminders
          </Label>
          <Switch
            id="event-reminders"
            checked={preferences.eventRemindersEnabled}
            onCheckedChange={(checked) => onUpdate({ eventRemindersEnabled: checked })}
            disabled={isUpdating}
            data-testid="switch-event-reminders"
          />
        </div>
        {preferences.eventRemindersEnabled && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Remind me {preferences.eventReminderDays} days before
            </Label>
            <Slider
              value={[preferences.eventReminderDays]}
              onValueChange={([value]) => onUpdate({ eventReminderDays: value })}
              min={1}
              max={14}
              step={1}
              disabled={isUpdating}
              data-testid="slider-event-days"
            />
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="font-medium text-sm">Invoice & Estimate Reminders</h4>
        <div className="flex items-center justify-between">
          <Label htmlFor="invoice-reminders" className="text-sm">
            Invoice due reminders
          </Label>
          <Switch
            id="invoice-reminders"
            checked={preferences.invoiceDueRemindersEnabled}
            onCheckedChange={(checked) => onUpdate({ invoiceDueRemindersEnabled: checked })}
            disabled={isUpdating}
            data-testid="switch-invoice-reminders"
          />
        </div>
        {preferences.invoiceDueRemindersEnabled && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Remind {preferences.invoiceReminderDays} days before due
            </Label>
            <Slider
              value={[preferences.invoiceReminderDays]}
              onValueChange={([value]) => onUpdate({ invoiceReminderDays: value })}
              min={1}
              max={14}
              step={1}
              disabled={isUpdating}
              data-testid="slider-invoice-days"
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <Label htmlFor="estimate-reminders" className="text-sm">
            Estimate expiry reminders
          </Label>
          <Switch
            id="estimate-reminders"
            checked={preferences.estimateDueRemindersEnabled}
            onCheckedChange={(checked) => onUpdate({ estimateDueRemindersEnabled: checked })}
            disabled={isUpdating}
            data-testid="switch-estimate-reminders"
          />
        </div>
        {preferences.estimateDueRemindersEnabled && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Remind {preferences.estimateReminderDays} days before expiry
            </Label>
            <Slider
              value={[preferences.estimateReminderDays]}
              onValueChange={([value]) => onUpdate({ estimateReminderDays: value })}
              min={1}
              max={14}
              step={1}
              disabled={isUpdating}
              data-testid="slider-estimate-days"
            />
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="font-medium text-sm">Production Planning</h4>
        <div className="flex items-center justify-between">
          <Label htmlFor="production-reminders" className="text-sm">
            Production deadline reminders
          </Label>
          <Switch
            id="production-reminders"
            checked={preferences.productionDeadlineRemindersEnabled}
            onCheckedChange={(checked) => onUpdate({ productionDeadlineRemindersEnabled: checked })}
            disabled={isUpdating}
            data-testid="switch-production-reminders"
          />
        </div>
        {preferences.productionDeadlineRemindersEnabled && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              Remind {preferences.productionReminderDays} days before setup
            </Label>
            <Slider
              value={[preferences.productionReminderDays]}
              onValueChange={([value]) => onUpdate({ productionReminderDays: value })}
              min={1}
              max={7}
              step={1}
              disabled={isUpdating}
              data-testid="slider-production-days"
            />
          </div>
        )}
      </div>

      <Separator />

      <div className="space-y-4">
        <h4 className="font-medium text-sm">Leave Requests</h4>
        <div className="flex items-center justify-between">
          <Label htmlFor="leave-notifications" className="text-sm">
            Leave request notifications
          </Label>
          <Switch
            id="leave-notifications"
            checked={preferences.leaveRequestNotificationsEnabled}
            onCheckedChange={(checked) => onUpdate({ leaveRequestNotificationsEnabled: checked })}
            disabled={isUpdating}
            data-testid="switch-leave-notifications"
          />
        </div>
      </div>

      <Separator />

      <WhatsAppSettings
        preferences={preferences}
        onUpdate={onUpdate}
        isUpdating={isUpdating}
      />
    </div>
  );
}

function WhatsAppSettings({
  preferences,
  onUpdate,
  isUpdating,
}: {
  preferences: NotificationPreference;
  onUpdate: (data: Partial<NotificationPreference>) => void;
  isUpdating: boolean;
}) {
  const [phoneNumber, setPhoneNumber] = useState(preferences.whatsappPhoneNumber || '');
  const [testLoading, setTestLoading] = useState(false);
  const { toast } = useToast();

  const { data: whatsappStatus } = useQuery<{ configured: boolean; message: string }>({
    queryKey: ["/api/whatsapp/status"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/status", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to check WhatsApp status");
      return res.json();
    },
  });

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(value);
  };

  const handleSavePhone = () => {
    onUpdate({ whatsappPhoneNumber: phoneNumber });
  };

  const handleSendTest = async () => {
    if (!phoneNumber) {
      toast({ title: "Error", description: "Please enter your phone number first", variant: "destructive" });
      return;
    }

    setTestLoading(true);
    try {
      const res = await fetch("/api/whatsapp/send-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast({ title: "Success", description: "Test message sent! Check your WhatsApp." });
      } else {
        toast({ title: "Error", description: data.error || "Failed to send test message", variant: "destructive" });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Failed to send test message", variant: "destructive" });
    } finally {
      setTestLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h4 className="font-medium text-sm">WhatsApp Notifications</h4>
        {whatsappStatus?.configured ? (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Connected</span>
        ) : (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Not Configured</span>
        )}
      </div>

      {!whatsappStatus?.configured && (
        <p className="text-xs text-muted-foreground">
          WhatsApp notifications require Twilio credentials to be configured by your administrator.
        </p>
      )}

      {whatsappStatus?.configured && (
        <>
          <div className="flex items-center justify-between">
            <Label htmlFor="whatsapp-enabled" className="text-sm">
              Enable WhatsApp notifications
            </Label>
            <Switch
              id="whatsapp-enabled"
              checked={preferences.whatsappEnabled}
              onCheckedChange={(checked) => onUpdate({ whatsappEnabled: checked })}
              disabled={isUpdating}
              data-testid="switch-whatsapp-enabled"
            />
          </div>

          {preferences.whatsappEnabled && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="whatsapp-phone" className="text-xs text-muted-foreground">
                  Your WhatsApp Number (with country code, e.g., +91 98765 43210)
                </Label>
                <div className="flex gap-2">
                  <input
                    id="whatsapp-phone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="flex-1 px-3 py-2 text-sm border rounded-md bg-background"
                    data-testid="input-whatsapp-phone"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSavePhone}
                    disabled={isUpdating || phoneNumber === preferences.whatsappPhoneNumber}
                    data-testid="button-save-phone"
                  >
                    Save
                  </Button>
                </div>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={handleSendTest}
                disabled={testLoading || !phoneNumber}
                className="w-full"
                data-testid="button-send-test-whatsapp"
              >
                {testLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Test Message"
                )}
              </Button>

              <p className="text-xs text-muted-foreground">
                Note: For Twilio sandbox, you must first send "join &lt;sandbox-code&gt;" to the WhatsApp number before receiving messages.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

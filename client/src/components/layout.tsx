import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Users,
  Database,
  BookOpen,
  LayoutDashboard,
  Shield,
  LogOut,
  Menu,
  Briefcase,
  CheckSquare,
  Receipt,
  Target,
  Package,
  UserCircle,
  Sparkles,
  ClipboardList,
  Palette,
  Bell,
  Check,
  Info,
  AlertTriangle,
  AlertCircle,
  MessageSquare,
  Plus,
  MoreHorizontal,
  Home,
  FileText,
  Settings,
  ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, format } from "date-fns";
import logo from "@assets/oakstreet_white_1764858814551.png";

const ALL_PAGES = [
  { id: "dashboard", label: "Dashboard", path: "/" },
  { id: "sales", label: "Sales", path: "/oak-sales", subPages: [
    { id: "sales-leads", label: "Leads", path: "/oak-sales?section=dashboard" },
    { id: "sales-pipeline", label: "Pipeline", path: "/oak-sales?section=pipeline" },
    { id: "sales-estimates", label: "Estimates", path: "/oak-sales?section=estimates" },
    { id: "sales-reports", label: "Reports", path: "/oak-sales?section=reports" },
    { id: "sales-settings", label: "Settings", path: "/oak-sales?section=settings" },
  ] },
  { id: "event-calendar", label: "Oak Event Calendar", path: "/events", subPages: [
    { id: "monthly-plan", label: "Monthly Plan", path: "/monthly-plan" },
  ] },
  { id: "team-calendar", label: "Oak Team Calendar", path: "/team" },
  { id: "event-database", label: "Oak Event Database", path: "/database" },
  { id: "event-milestones", label: "Oak Event Milestones", path: "/milestones" },
  { id: "daybook", label: "Oak Daybook", path: "/daybook" },
  { id: "oak-book", label: "Oak Book", path: "/oak-book" },
  { id: "oak-inventory", label: "Oak Inventory", path: "/oak-inventory" },
  { id: "execution-plan", label: "Execution Plan", path: "/execution-plan" },
  { id: "hr", label: "Oak HR", path: "/hr" },
  { id: "employee-portal", label: "Employee Portal", path: "/employee-portal" },
  { id: "oaksy", label: "Oaksy AI", path: "/oaksy" },
  { id: "oak-creative", label: "Oak Creative", path: "/oak-creative" },
  { id: "whatsapp-inbox", label: "WhatsApp Inbox", path: "/whatsapp-inbox" },
  { id: "oak-rsvp", label: "Oak RSVP", path: "/oak-rsvp" },
  { id: "admin", label: "Admin Panel", path: "/admin" },
];

const ICONS: Record<string, any> = {
  dashboard: LayoutDashboard,
  "event-calendar": Calendar,
  "monthly-plan": Calendar,
  "team-calendar": Users,
  "event-database": Database,
  "event-milestones": CheckSquare,
  daybook: BookOpen,
  "oak-book": Receipt,
  "sales": Target,
  "sales-leads": Users,
  "sales-pipeline": Target,
  "sales-estimates": FileText,
  "sales-reports": LayoutDashboard,
  "sales-settings": Settings,
  "oak-inventory": Package,
  "execution-plan": ClipboardList,
  hr: Briefcase,
  "employee-portal": UserCircle,
  oaksy: Sparkles,
  "oak-creative": Palette,
  "whatsapp-inbox": MessageSquare,
  "oak-rsvp": Users,
  admin: Shield,
};

const PAGES_WITH_OWN_SIDEBAR = ["/oak-book", "/oak-sales", "/oak-inventory"];

const MOBILE_BOTTOM_NAV = [
  { id: "dashboard", label: "Home", path: "/", icon: Home },
  { id: "oak-book", label: "Book", path: "/oak-book", icon: Receipt },
  { id: "event-calendar", label: "Events", path: "/events", icon: Calendar },
  { id: "daybook", label: "Daybook", path: "/daybook", icon: BookOpen },
  { id: "more", label: "More", path: null, icon: MoreHorizontal },
];

const NOTIFICATION_ICONS: Record<string, any> = {
  info: Info,
  success: Check,
  warning: AlertTriangle,
  error: AlertCircle,
};

function NotificationBell() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<any>(null);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["/api/notifications/unread-count"],
    queryFn: async () => {
      const res = await fetch("/api/notifications/unread-count", { credentials: "include" });
      if (!res.ok) return 0;
      const data = await res.json();
      return data.count || 0;
    },
    refetchInterval: 30000,
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["/api/notifications"],
    queryFn: async () => {
      const res = await fetch("/api/notifications", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isOpen,
  });

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, {
        method: "POST",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    },
  });

  return (
    <>
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
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[#6b9937] text-white text-xs flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 border-b bg-muted/50">
          <h4 className="font-semibold text-sm">Notifications</h4>
        </div>
        <ScrollArea className="h-[300px]">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              No notifications yet
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification: any) => {
                const Icon = NOTIFICATION_ICONS[notification.type] || Info;
                const isUnread = !notification.readAt;
                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "p-3 hover:bg-muted/50 cursor-pointer transition-colors",
                      isUnread && "bg-[#6b9937]/5"
                    )}
                    onClick={() => {
                      if (isUnread) {
                        markAsRead.mutate(notification.id);
                      }
                      setSelectedNotification(notification);
                      setIsOpen(false);
                    }}
                    data-testid={`notification-item-${notification.id}`}
                  >
                    <div className="flex gap-3">
                      <div className={cn(
                        "mt-0.5 p-1.5 rounded-full shrink-0",
                        notification.type === "success" && "bg-green-100 text-green-600",
                        notification.type === "warning" && "bg-amber-100 text-amber-600",
                        notification.type === "error" && "bg-red-100 text-red-600",
                        notification.type === "info" && "bg-blue-100 text-blue-600"
                      )}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={cn("text-sm", isUnread && "font-semibold")}>
                            {notification.title}
                          </p>
                          {isUnread && (
                            <span className="h-2 w-2 rounded-full bg-[#6b9937]" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {notification.createdAt && formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>

    <Dialog open={!!selectedNotification} onOpenChange={(open) => !open && setSelectedNotification(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            {selectedNotification && (
              <div className={cn(
                "p-2 rounded-full shrink-0",
                selectedNotification.type === "success" && "bg-green-100 text-green-600",
                selectedNotification.type === "warning" && "bg-amber-100 text-amber-600",
                selectedNotification.type === "error" && "bg-red-100 text-red-600",
                selectedNotification.type === "info" && "bg-blue-100 text-blue-600"
              )}>
                {(() => {
                  const Icon = NOTIFICATION_ICONS[selectedNotification?.type] || Info;
                  return <Icon className="h-5 w-5" />;
                })()}
              </div>
            )}
            <DialogTitle>{selectedNotification?.title}</DialogTitle>
          </div>
          {selectedNotification?.createdAt && (
            <p className="text-xs text-muted-foreground mt-2">
              {format(new Date(selectedNotification.createdAt), 'PPpp')}
            </p>
          )}
        </DialogHeader>
        <div className="mt-4">
          <p className="text-sm text-foreground whitespace-pre-wrap">
            {selectedNotification?.message}
          </p>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          {selectedNotification?.actionUrl && (
            <Button
              variant="outline"
              onClick={() => {
                window.location.href = selectedNotification.actionUrl;
              }}
              data-testid="button-notification-action"
            >
              Open Link
            </Button>
          )}
          <Button
            onClick={() => setSelectedNotification(null)}
            className="bg-[#6b9937] hover:bg-[#5a8230]"
            data-testid="button-close-notification"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Super Admin",
  admin: "Admin",
  manager: "Operations Manager",
  employee: "Employee",
  wedding_planner: "Wedding Planner",
  accountant: "Accountant",
  production_manager: "Production Manager",
};

function MobileBottomNav({ allowedPages, currentPath }: { allowedPages: string[], currentPath: string }) {
  const [moreOpen, setMoreOpen] = useState(false);
  
  const moreMenuItems = ALL_PAGES.filter(
    page => allowedPages.includes(page.id) && !MOBILE_BOTTOM_NAV.find(nav => nav.id === page.id)
  );

  return (
    <>
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {MOBILE_BOTTOM_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.path ? currentPath === item.path : false;
            const hasAccess = item.id === "more" || allowedPages.includes(item.id);
            
            if (!hasAccess) return null;
            
            if (item.id === "more") {
              return (
                <button
                  key={item.id}
                  onClick={() => setMoreOpen(true)}
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 h-full min-w-[64px] touch-manipulation",
                    "text-gray-500 active:bg-gray-100 transition-colors"
                  )}
                  data-testid="nav-mobile-more"
                >
                  <Icon className="h-6 w-6 mb-1" />
                  <span className="text-xs font-medium">{item.label}</span>
                </button>
              );
            }
            
            return (
              <Link key={item.id} href={item.path!}>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  className={cn(
                    "flex flex-col items-center justify-center flex-1 h-full min-w-[64px] touch-manipulation",
                    isActive 
                      ? "text-primary" 
                      : "text-gray-500 active:bg-gray-100"
                  )}
                  data-testid={`nav-mobile-${item.id}`}
                >
                  <Icon className={cn("h-6 w-6 mb-1", isActive && "text-primary")} />
                  <span className={cn("text-xs font-medium", isActive && "text-primary")}>{item.label}</span>
                  {isActive && (
                    <motion.div
                      layoutId="mobileActiveTab"
                      className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full"
                    />
                  )}
                </motion.button>
              </Link>
            );
          })}
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="h-[70vh] rounded-t-2xl p-0">
          <div className="p-4 border-b">
            <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-center">More Options</h3>
          </div>
          <ScrollArea className="h-[calc(70vh-80px)]">
            <div className="p-4 grid grid-cols-3 gap-4">
              {moreMenuItems.map((item) => {
                const Icon = ICONS[item.id] || LayoutDashboard;
                const isActive = currentPath === item.path;
                return (
                  <Link key={item.id} href={item.path}>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex flex-col items-center justify-center p-4 rounded-xl w-full",
                        "min-h-[88px] touch-manipulation transition-colors",
                        isActive 
                          ? "bg-primary/10 text-primary" 
                          : "bg-gray-50 text-gray-700 active:bg-gray-100"
                      )}
                      data-testid={`nav-more-${item.id}`}
                    >
                      <Icon className="h-7 w-7 mb-2" />
                      <span className="text-xs font-medium text-center leading-tight">{item.label}</span>
                    </motion.button>
                  </Link>
                );
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, allowedPages, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({ sales: true });

  if (!user) return <div className="min-h-screen bg-background">{children}</div>;

  const hasOwnSidebar = PAGES_WITH_OWN_SIDEBAR.includes(location);
  const navItems = ALL_PAGES.filter((page) => allowedPages.includes(page.id));

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  const NavContent = () => (
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      {/* Zoho-style clean header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">O</span>
          </div>
          <div>
            <h1 className="font-semibold text-base text-sidebar-foreground">Oakstreet Events</h1>
            <p className="text-xs text-sidebar-foreground/60">Event Management</p>
          </div>
        </div>
      </div>

      {/* Zoho-style navigation list */}
      <div className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {navItems.map((item, index) => {
          const Icon = ICONS[item.id] || LayoutDashboard;
          const hasSubPages = (item as any).subPages?.length > 0;
          const subPages = (item as any).subPages || [];
          const isExpanded = expandedMenus[item.id] ?? false;
          
          // Check if current URL matches the parent or any subpage
          const currentFullUrl = window.location.pathname + window.location.search;
          const parentPath = item.path.split('?')[0];
          const isActive = location === item.path && !hasSubPages;
          const isParentOfActive = hasSubPages && (location === parentPath || subPages.some((sp: any) => {
            const spPath = sp.path.split('?')[0];
            return location === spPath || currentFullUrl === sp.path;
          }));
          
          // For collapsible menus (like Sales), use button to toggle; for others use Link
          if (hasSubPages && item.id === 'sales') {
            return (
              <div key={item.id}>
                <button
                  onClick={() => toggleMenu(item.id)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
                    isParentOfActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                  data-testid={`nav-${item.id}`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn("h-4 w-4", isParentOfActive ? "text-primary" : "text-sidebar-foreground/70")} />
                    <span>{item.label}</span>
                  </div>
                  <ChevronDown className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    isExpanded ? "rotate-0" : "-rotate-90",
                    isParentOfActive ? "text-primary" : "text-sidebar-foreground/50"
                  )} />
                </button>
                <AnimatePresence initial={false}>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      {subPages.map((subPage: any) => {
                        const SubIcon = ICONS[subPage.id] || Calendar;
                        const isSubActive = currentFullUrl === subPage.path || 
                          (subPage.path.includes('?') && location === subPage.path.split('?')[0] && window.location.search === '?' + subPage.path.split('?')[1]);
                        const hasAccess = allowedPages.includes(subPage.id);
                        if (!hasAccess) return null;
                        return (
                          <Link key={subPage.id} href={subPage.path}>
                            <button
                              className={cn(
                                "w-full flex items-center gap-3 px-3 py-2 pl-10 rounded-md text-sm transition-colors",
                                isSubActive
                                  ? "bg-primary/10 text-primary font-medium"
                                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
                              )}
                              onClick={() => setIsMobileOpen(false)}
                              data-testid={`nav-${subPage.id}`}
                            >
                              <SubIcon className={cn("h-3.5 w-3.5", isSubActive ? "text-primary" : "text-sidebar-foreground/60")} />
                              <span>{subPage.label}</span>
                            </button>
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }
          
          // Regular menu items (with or without subpages)
          const parentHref = hasSubPages ? item.path : item.path;
          
          return (
            <div key={item.id}>
              <Link href={parentHref}>
                <button
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                    isActive || isParentOfActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  )}
                  onClick={() => setIsMobileOpen(false)}
                  data-testid={`nav-${item.id}`}
                >
                  <Icon className={cn("h-4 w-4", isActive || isParentOfActive ? "text-primary" : "text-sidebar-foreground/70")} />
                  <span>{item.label}</span>
                </button>
              </Link>
              {hasSubPages && subPages.map((subPage: any) => {
                const SubIcon = ICONS[subPage.id] || Calendar;
                const isSubActive = currentFullUrl === subPage.path || 
                  (subPage.path.includes('?') && location === subPage.path.split('?')[0] && window.location.search === '?' + subPage.path.split('?')[1]);
                const hasAccess = allowedPages.includes(subPage.id);
                if (!hasAccess) return null;
                return (
                  <Link key={subPage.id} href={subPage.path}>
                    <button
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 pl-10 rounded-md text-sm transition-colors",
                        isSubActive
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
                      )}
                      onClick={() => setIsMobileOpen(false)}
                      data-testid={`nav-${subPage.id}`}
                    >
                      <SubIcon className={cn("h-3.5 w-3.5", isSubActive ? "text-primary" : "text-sidebar-foreground/60")} />
                      <span>{subPage.label}</span>
                    </button>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Zoho-style user section */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.avatar || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
              {user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate text-sidebar-foreground">{user.name}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {ROLE_LABELS[user.role] || user.role}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </Button>
      </div>
    </div>
  );

  if (hasOwnSidebar) {
    return (
      <div className="min-h-screen md:min-h-screen min-h-[100dvh] bg-background pb-16 md:pb-0">
        {children}
        <MobileBottomNav allowedPages={allowedPages} currentPath={location} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen md:min-h-screen min-h-[100dvh] bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 border-r bg-sidebar">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b h-14 flex items-center justify-between px-4 shadow-sm">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-11 w-11 touch-manipulation">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 border-r-0">
            <NavContent />
          </SheetContent>
        </Sheet>
        <img src={logo} alt="Oakstreet Events" className="h-9 w-auto" />
        <NotificationBell />
      </div>

      {/* Desktop Notification Bell */}
      <div className="hidden md:flex fixed top-4 right-6 z-40">
        <NotificationBell />
      </div>

      {/* Main Content - Full height with proper mobile padding */}
      <main className="flex-1 overflow-y-auto h-[100dvh] md:h-screen">
        <AnimatePresence mode="wait">
          <motion.div 
            key={location}
            className="p-4 pt-16 pb-20 md:pt-6 md:pb-6 md:p-8 md:pr-12 max-w-7xl mx-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav allowedPages={allowedPages} currentPath={location} />
    </div>
  );
}

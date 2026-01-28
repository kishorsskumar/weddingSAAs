import { useState } from "react";
import { Link, useLocation, useRoute } from "wouter";
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
  ChevronDown,
  DollarSign,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow, format } from "date-fns";

const ALL_PAGES = [
  { id: "dashboard", label: "Dashboard", path: "/" },
  { id: "sales", label: "Sales", path: "/oak-sales", subPages: [
    { id: "sales-leads", label: "Leads", path: "/oak-sales?section=dashboard" },
    { id: "sales-pipeline", label: "Pipeline", path: "/oak-sales?section=pipeline" },
    { id: "sales-estimates", label: "Estimates", path: "/oak-sales?section=estimates" },
    { id: "sales-reports", label: "Reports", path: "/oak-sales?section=reports" },
    { id: "sales-settings", label: "Settings", path: "/oak-sales?section=settings" },
  ] },
  { id: "event-hub", label: "Event Hub", path: "/events", subPages: [
    { id: "event-calendar", label: "Calendar", path: "/events" },
    { id: "event-milestones", label: "Timeline", path: "/milestones" },
    { id: "execution-plan", label: "Execution", path: "/execution-plan" },
  ] },
  { id: "operations", label: "Operations", path: "/oak-inventory", subPages: [
    { id: "ops-items", label: "Inventory Items", path: "/oak-inventory?section=items", group: "Stock & Assets" },
    { id: "ops-purchase-orders", label: "Purchase Orders", path: "/oak-inventory?section=purchase-orders", group: "Stock & Assets" },
    { id: "ops-templates", label: "Templates", path: "/oak-inventory?section=templates", group: "Stock & Assets" },
    { id: "ops-event-inventory", label: "Event Inventory", path: "/oak-inventory?section=event-inventory", group: "Event Fulfilment" },
    { id: "ops-rentals", label: "Rentals", path: "/oak-inventory?section=rentals", group: "Event Fulfilment" },
    { id: "ops-production", label: "Production Planning", path: "/oak-inventory?section=decor-planning", group: "Production" },
    { id: "ops-execution", label: "Execution Plans", path: "/oak-inventory?section=production-plans", group: "Production" },
    { id: "ops-transportation", label: "Event Transportation", path: "/oak-inventory?section=transportation", group: "Logistics" },
    { id: "ops-manpower", label: "Event Manpower", path: "/oak-inventory?section=manpower", group: "Workforce" },
  ] },
  { id: "finance", label: "Finance", path: "/oak-book", subPages: [
    { id: "finance-masters", label: "Masters", path: "/oak-book?section=customers", group: "Masters" },
    { id: "finance-customers", label: "Customers", path: "/oak-book?section=customers", group: "Masters" },
    { id: "finance-vendors", label: "Vendors", path: "/oak-book?section=vendors", group: "Masters" },
    { id: "finance-estimates", label: "Estimates", path: "/oak-book?section=standard-estimates", group: "Sales" },
    { id: "finance-invoices", label: "Invoices", path: "/oak-book?section=standard-invoices", group: "Sales" },
    { id: "finance-payments", label: "Payments Received", path: "/oak-book?section=payments-received", group: "Sales" },
    { id: "daybook", label: "Day Book", path: "/daybook" },
    { id: "finance-reports", label: "Reports", path: "/oak-book?section=reports" },
    { id: "finance-settings", label: "Settings", path: "/oak-book?section=settings" },
  ] },
  { id: "people", label: "People", path: "/hr", subPages: [
    { id: "hr", label: "HR Management", path: "/hr" },
    { id: "employee-portal", label: "Employee Portal", path: "/employee-portal" },
    { id: "team-calendar", label: "Team Calendar", path: "/team" },
  ] },
  { id: "knotvite", label: "KnotVite RSVP", path: "/knotvite/dashboard", subPages: [
    { id: "knotvite-dashboard", label: "Dashboard", path: "/knotvite/dashboard" },
    { id: "knotvite-forms", label: "Form Builder", path: "/knotvite/forms" },
    { id: "knotvite-submissions", label: "Submissions", path: "/knotvite/submissions" },
  ] },
  { id: "tools", label: "Tools", path: "/whatsapp-inbox", subPages: [
    { id: "whatsapp-inbox", label: "WhatsApp Inbox", path: "/whatsapp-inbox" },
    { id: "oak-rsvp", label: "RSVP Manager", path: "/oak-rsvp" },
    { id: "oaksy", label: "AI Assistant", path: "/oaksy" },
    { id: "oak-creative", label: "Creative Studio", path: "/oak-creative" },
  ] },
  { id: "management-mis", label: "Management MIS", path: "/management-mis", superadminOnly: true, subPages: [
    { id: "mis-overview", label: "Overview Dashboard", path: "/management-mis" },
    { id: "event-database", label: "Event Database", path: "/database", superadminOnly: true },
    { id: "mis-financial", label: "Financial Summary", path: "/management-mis?tab=financial", superadminOnly: true },
    { id: "mis-sales", label: "Sales Performance", path: "/management-mis?tab=sales", superadminOnly: true },
    { id: "mis-operations", label: "Operations Snapshot", path: "/management-mis?tab=operations", superadminOnly: true },
  ] },
  { id: "admin", label: "Admin Panel", path: "/admin" },
];

const ICONS: Record<string, any> = {
  dashboard: LayoutDashboard,
  "event-hub": Calendar,
  "event-calendar": Calendar,
  "team-calendar": Users,
  "event-database": Database,
  "event-milestones": CheckSquare,
  daybook: BookOpen,
  "finance": Receipt,
  "finance-masters": Database,
  "finance-customers": Users,
  "finance-vendors": Users,
  "finance-estimates": FileText,
  "finance-invoices": Receipt,
  "finance-payments": Receipt,
  "finance-reports": LayoutDashboard,
  "finance-settings": Settings,
  "sales": Target,
  "sales-leads": Users,
  "sales-pipeline": Target,
  "sales-estimates": FileText,
  "sales-reports": LayoutDashboard,
  "sales-settings": Settings,
  "operations": Package,
  "ops-items": Package,
  "ops-purchase-orders": ClipboardList,
  "ops-templates": ClipboardList,
  "management-mis": LayoutDashboard,
  "mis-overview": LayoutDashboard,
  "mis-financial": DollarSign,
  "mis-sales": Target,
  "mis-operations": Package,
  "ops-event-inventory": Package,
  "ops-rentals": Package,
  "ops-production": ClipboardList,
  "ops-execution": ClipboardList,
  "ops-transportation": Package,
  "ops-manpower": Users,
  "execution-plan": ClipboardList,
  "knotvite": FileText,
  "knotvite-dashboard": LayoutDashboard,
  "knotvite-forms": FileText,
  "knotvite-submissions": Users,
  "people": Users,
  hr: Briefcase,
  "employee-portal": UserCircle,
  "tools": Settings,
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
  const [location, navigate] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});

  if (!user) return <div className="min-h-screen bg-background">{children}</div>;

  const hasOwnSidebar = PAGES_WITH_OWN_SIDEBAR.includes(location);
  const isSuperAdmin = user?.role === 'superadmin';
  const navItems = ALL_PAGES.filter((page) => {
    if ((page as any).superadminOnly && !isSuperAdmin) return false;
    // Show parent page if user has access to parent OR any of its subpages
    if (allowedPages.includes(page.id)) return true;
    const subPages = (page as any).subPages || [];
    return subPages.some((sp: any) => allowedPages.includes(sp.id));
  });

  const toggleMenu = (menuId: string) => {
    setExpandedMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  const NavContent = () => (
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      {/* Zoho-style clean header */}
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">W</span>
          </div>
          <div>
            <h1 className="font-semibold text-base text-sidebar-foreground">Wedding SaaS</h1>
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
          
          // For collapsible menus (Sales, Event Hub, Operations, Finance, People, Tools, Management MIS), use button to toggle; for others use Link
          const isCollapsibleMenu = item.id === 'sales' || item.id === 'event-hub' || item.id === 'operations' || item.id === 'finance' || item.id === 'people' || item.id === 'tools' || item.id === 'management-mis';
          if (hasSubPages && isCollapsibleMenu) {
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
                      {(() => {
                        let lastGroup: string | null = null;
                        return subPages.map((subPage: any) => {
                          const SubIcon = ICONS[subPage.id] || Calendar;
                          const isSubActive = currentFullUrl === subPage.path || 
                            (subPage.path.includes('?') && location === subPage.path.split('?')[0] && window.location.search === '?' + subPage.path.split('?')[1]);
                          const hasAccess = allowedPages.includes(subPage.id) && (!((subPage as any).superadminOnly) || isSuperAdmin);
                          if (!hasAccess) return null;
                          
                          const showGroupHeader = subPage.group && subPage.group !== lastGroup;
                          if (subPage.group) lastGroup = subPage.group;
                          
                          return (
                            <div key={subPage.id}>
                              {showGroupHeader && (
                                <div className="px-3 py-1.5 pl-10 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/40 mt-2 first:mt-0">
                                  {subPage.group}
                                </div>
                              )}
                              <Link 
                                href={subPage.path}
                                onClick={() => setIsMobileOpen(false)}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2 pl-10 rounded-md text-sm transition-colors cursor-pointer",
                                  isSubActive
                                    ? "bg-primary/10 text-primary font-medium"
                                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
                                )}
                                data-testid={`nav-${subPage.id}`}
                              >
                                <SubIcon className={cn("h-3.5 w-3.5", isSubActive ? "text-primary" : "text-sidebar-foreground/60")} />
                                <span>{subPage.label}</span>
                              </Link>
                            </div>
                          );
                        });
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }
          
          // Regular menu items (with or without subpages)
          const parentHref = hasSubPages ? item.path : item.path;
          
          const handleNavClick = (path: string) => {
            setIsMobileOpen(false);
            // Use both navigate and window.location for maximum compatibility
            navigate(path);
            // Force navigation if wouter doesn't pick it up
            setTimeout(() => {
              if (window.location.pathname !== path.split('?')[0]) {
                window.location.href = path;
              }
            }, 50);
          };
          
          return (
            <div key={item.id}>
              <div 
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleNavClick(parentHref);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors cursor-pointer",
                  isActive || isParentOfActive
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
                data-testid={`nav-${item.id}`}
              >
                <Icon className={cn("h-4 w-4", isActive || isParentOfActive ? "text-primary" : "text-sidebar-foreground/70")} />
                <span>{item.label}</span>
              </div>
              {hasSubPages && subPages.map((subPage: any) => {
                const SubIcon = ICONS[subPage.id] || Calendar;
                const isSubActive = currentFullUrl === subPage.path || 
                  (subPage.path.includes('?') && location === subPage.path.split('?')[0] && window.location.search === '?' + subPage.path.split('?')[1]);
                const hasAccess = allowedPages.includes(subPage.id) && (!((subPage as any).superadminOnly) || isSuperAdmin);
                if (!hasAccess) return null;
                return (
                  <div 
                    key={subPage.id} 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleNavClick(subPage.path);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 pl-10 rounded-md text-sm transition-colors cursor-pointer",
                      isSubActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-sidebar-foreground/70 hover:bg-sidebar-accent"
                    )}
                    data-testid={`nav-${subPage.id}`}
                  >
                    <SubIcon className={cn("h-3.5 w-3.5", isSubActive ? "text-primary" : "text-sidebar-foreground/60")} />
                    <span>{subPage.label}</span>
                  </div>
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
        <div className="flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          <span className="font-semibold text-lg">Wedding SaaS</span>
        </div>
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

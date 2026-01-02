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
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import logo from "@assets/oakstreet_white_1764858814551.png";

const ALL_PAGES = [
  { id: "dashboard", label: "Dashboard", path: "/" },
  { id: "event-calendar", label: "Oak Event Calendar", path: "/events" },
  { id: "team-calendar", label: "Oak Team Calendar", path: "/team" },
  { id: "event-database", label: "Oak Event Database", path: "/database" },
  { id: "event-milestones", label: "Oak Event Milestones", path: "/milestones" },
  { id: "daybook", label: "Oak Daybook", path: "/daybook" },
  { id: "oak-book", label: "Oak Book", path: "/oak-book" },
  { id: "oak-sales", label: "Oak Sales", path: "/oak-sales" },
  { id: "oak-inventory", label: "Oak Inventory", path: "/oak-inventory" },
  { id: "execution-plan", label: "Execution Plan", path: "/execution-plan" },
  { id: "hr", label: "Oak HR", path: "/hr" },
  { id: "employee-portal", label: "Employee Portal", path: "/employee-portal" },
  { id: "oaksy", label: "Oaksy AI", path: "/oaksy" },
  { id: "oak-creative", label: "Oak Creative", path: "/oak-creative" },
  { id: "admin", label: "Admin Panel", path: "/admin" },
];

const ICONS: Record<string, any> = {
  dashboard: LayoutDashboard,
  "event-calendar": Calendar,
  "team-calendar": Users,
  "event-database": Database,
  "event-milestones": CheckSquare,
  daybook: BookOpen,
  "oak-book": Receipt,
  "oak-sales": Target,
  "oak-inventory": Package,
  "execution-plan": ClipboardList,
  hr: Briefcase,
  "employee-portal": UserCircle,
  oaksy: Sparkles,
  "oak-creative": Palette,
  admin: Shield,
};

const PAGES_WITH_OWN_SIDEBAR = ["/oak-book", "/oak-sales", "/oak-inventory"];

const NOTIFICATION_ICONS: Record<string, any> = {
  info: Info,
  success: Check,
  warning: AlertTriangle,
  error: AlertCircle,
};

function NotificationBell() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);

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
                      if (notification.actionUrl) {
                        window.location.href = notification.actionUrl;
                      }
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

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, allowedPages, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (!user) return <div className="min-h-screen bg-background">{children}</div>;

  const hasOwnSidebar = PAGES_WITH_OWN_SIDEBAR.includes(location);
  const navItems = ALL_PAGES.filter((page) => allowedPages.includes(page.id));

  const NavContent = () => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <motion.div 
        className="p-6"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <img src={logo} alt="Oak Event" className="h-16 w-auto mb-2" />
        <p className="text-xs text-sidebar-foreground/60 mt-1">Crafting your Stories</p>
      </motion.div>

      <motion.div 
        className="flex-1 px-4 py-4 space-y-1 overflow-y-auto"
        initial="initial"
        animate="animate"
        variants={{
          initial: {},
          animate: { transition: { staggerChildren: 0.05, delayChildren: 0.1 } }
        }}
      >
        {navItems.map((item, index) => {
          const Icon = ICONS[item.id] || LayoutDashboard;
          const isActive = location === item.path;
          return (
            <motion.div
              key={item.id}
              variants={{
                initial: { opacity: 0, x: -20 },
                animate: { opacity: 1, x: 0 }
              }}
              transition={{ duration: 0.3 }}
            >
              <Link href={item.path}>
                <motion.div
                  whileHover={{ x: 4 }}
                  whileTap={{ scale: 0.98 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                >
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start gap-3 text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                        : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    )}
                    onClick={() => setIsMobileOpen(false)}
                    data-testid={`nav-${item.id}`}
                  >
                    <span className={cn("transition-transform duration-300", isActive && "scale-110")}>
                      <Icon className="h-4 w-4" />
                    </span>
                    {item.label}
                    {isActive && (
                      <motion.div
                        layoutId="activeIndicator"
                        className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    )}
                  </Button>
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div 
        className="p-4 border-t border-sidebar-border"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <motion.div
            whileHover={{ scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <Avatar className="h-8 w-8 border border-sidebar-border">
              <AvatarImage src={user.avatar || undefined} />
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                {user.name.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </motion.div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate">
              {ROLE_LABELS[user.role] || user.role}
            </p>
          </div>
        </div>
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        >
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
            Log Out
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );

  if (hasOwnSidebar) {
    return (
      <div className="min-h-screen bg-background">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 border-r bg-sidebar">
        <NavContent />
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-background border-b h-14 flex items-center justify-between px-4">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-64 border-r-0">
            <NavContent />
          </SheetContent>
        </Sheet>
        <NotificationBell />
      </div>

      {/* Desktop Notification Bell */}
      <div className="hidden md:flex fixed top-4 right-6 z-40">
        <NotificationBell />
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-screen">
        <motion.div 
          key={location}
          className="container mx-auto p-6 pt-16 md:pt-6 md:p-10 md:pr-16 max-w-7xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

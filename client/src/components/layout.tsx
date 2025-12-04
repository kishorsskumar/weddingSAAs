import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/context/auth-context";
import { cn } from "@/lib/utils";
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
  CheckSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import logo from "@assets/oakstreet_white_1764858814551.png";

const ALL_PAGES = [
  { id: "dashboard", label: "Dashboard", path: "/" },
  { id: "event-calendar", label: "Oak Event Calendar", path: "/events" },
  { id: "team-calendar", label: "Oak Team Calendar", path: "/team" },
  { id: "event-database", label: "Oak Event Database", path: "/database" },
  { id: "event-milestones", label: "Oak Event Milestones", path: "/milestones" },
  { id: "daybook", label: "Oak Daybook", path: "/daybook" },
  { id: "hr", label: "Oak HR", path: "/hr" },
  { id: "admin", label: "Admin Panel", path: "/admin" },
];

const ICONS: Record<string, any> = {
  dashboard: LayoutDashboard,
  "event-calendar": Calendar,
  "team-calendar": Users,
  "event-database": Database,
  "event-milestones": CheckSquare,
  daybook: BookOpen,
  hr: Briefcase,
  admin: Shield,
};

export default function Layout({ children }: { children: React.ReactNode }) {
  const { user, allowedPages, logout } = useAuth();
  const [location] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  if (!user) return <div className="min-h-screen bg-background">{children}</div>;

  const navItems = ALL_PAGES.filter((page) => allowedPages.includes(page.id));

  const NavContent = () => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="p-6">
        <img src={logo} alt="Oak Event" className="h-16 w-auto mb-2" />
        <p className="text-xs text-sidebar-foreground/60 mt-1">Crafting your Stories</p>
      </div>

      <div className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = ICONS[item.id] || LayoutDashboard;
          const isActive = location === item.path;
          return (
            <Link key={item.id} href={item.path}>
              <Button
                variant="ghost"
                className={cn(
                  "w-full justify-start gap-3 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                )}
                onClick={() => setIsMobileOpen(false)}
                data-testid={`nav-${item.id}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <Avatar className="h-8 w-8 border border-sidebar-border">
            <AvatarImage src={user.avatar || undefined} />
            <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
              {user.name.charAt(0)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-sidebar-foreground/60 truncate capitalize">
              {user.role}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground border-sidebar-border hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={logout}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" />
          Log Out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <aside className="hidden md:block w-64 shrink-0 border-r bg-sidebar">
        <NavContent />
      </aside>

      {/* Mobile Sidebar */}
      <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
        <SheetTrigger asChild className="md:hidden absolute top-4 left-4 z-50">
          <Button variant="outline" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-64 border-r-0">
          <NavContent />
        </SheetContent>
      </Sheet>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-screen">
        <div className="container mx-auto p-6 md:p-10 max-w-7xl animate-in fade-in slide-in-from-bottom-4 duration-500">
          {children}
        </div>
      </main>
    </div>
  );
}

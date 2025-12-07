import { useMemo } from "react";
import { Link } from "wouter";
import { useAuth } from "@/context/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Calendar, 
  DollarSign, 
  Users, 
  TrendingUp,
  LayoutDashboard,
  Database,
  CheckSquare,
  BookOpen,
  Receipt,
  Target,
  Package,
  Briefcase,
  Shield
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { Event } from "@/lib/types";
import type { InventoryItem } from "@shared/schema";

const ALL_PAGES = [
  { id: "dashboard", label: "Dashboard", path: "/", icon: LayoutDashboard, description: "Overview & stats" },
  { id: "event-calendar", label: "Oak Event Calendar", path: "/events", icon: Calendar, description: "Manage events" },
  { id: "team-calendar", label: "Oak Team Calendar", path: "/team", icon: Users, description: "Team scheduling" },
  { id: "event-database", label: "Oak Event Database", path: "/database", icon: Database, description: "Event records" },
  { id: "event-milestones", label: "Oak Milestones", path: "/milestones", icon: CheckSquare, description: "Track milestones" },
  { id: "daybook", label: "Oak Daybook", path: "/daybook", icon: BookOpen, description: "Daily finances" },
  { id: "oak-book", label: "Oak Book", path: "/oak-book", icon: Receipt, description: "Invoices & estimates" },
  { id: "oak-sales", label: "Oak Sales", path: "/oak-sales", icon: Target, description: "CRM & pipeline" },
  { id: "oak-inventory", label: "Oak Inventory", path: "/oak-inventory", icon: Package, description: "Inventory & rentals" },
  { id: "hr", label: "Oak HR", path: "/hr", icon: Briefcase, description: "HR & payroll" },
  { id: "admin", label: "Admin Panel", path: "/admin", icon: Shield, description: "User management" },
];

export default function Dashboard() {
  const { user, allowedPages } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'superadmin';
  const isSuperAdmin = user?.role === 'superadmin';
  
  const accessiblePages = isSuperAdmin 
    ? ALL_PAGES.filter(p => p.id !== 'dashboard')
    : ALL_PAGES.filter(p => allowedPages.includes(p.id) && p.id !== 'dashboard');
  const isWeddingPlanner = user?.role === 'wedding_planner' || user?.role === 'employee';

  const { data: allEvents = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    queryFn: async () => {
      const res = await fetch('/api/events');
      if (!res.ok) throw new Error('Failed to fetch events');
      return res.json();
    },
  });

  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory/items'],
    queryFn: async () => {
      const res = await fetch('/api/inventory/items');
      if (!res.ok) throw new Error('Failed to fetch inventory');
      return res.json();
    },
    enabled: isSuperAdmin,
  });

  const events = useMemo(() => {
    if (isAdmin) return allEvents;
    if (isWeddingPlanner) {
      return allEvents.filter(e => 
        e.planner?.toLowerCase() === user?.name?.toLowerCase()
      );
    }
    return allEvents;
  }, [allEvents, isAdmin, isWeddingPlanner, user?.name]);

  const totalSales = events.reduce((acc, curr) => acc + parseFloat(curr.salesValue || '0'), 0);
  const upcomingEvents = events.filter((e) => new Date(e.date) > new Date()).length;
  
  const totalInventoryValue = useMemo(() => {
    return inventoryItems.reduce((acc, item) => {
      const unitCost = typeof item.unitCost === 'string' ? parseFloat(item.unitCost) : (item.unitCost || 0);
      return acc + (item.stockQuantity * (isNaN(unitCost) ? 0 : unitCost));
    }, 0);
  }, [inventoryItems]);

  return (
    <div className="space-y-6 sm:space-y-8 px-2 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-serif text-primary">Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Welcome back, {user?.name}</p>
        </div>
        <div className="text-xs sm:text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full w-fit">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      <div className={`grid gap-3 sm:gap-4 ${isSuperAdmin ? 'grid-cols-2 lg:grid-cols-5' : isWeddingPlanner ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
        {(isSuperAdmin || isWeddingPlanner) && (
          <Card className="border-l-4 border-l-primary shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                {isWeddingPlanner ? 'My Revenue (FY)' : 'Total Revenue (FY)'}
              </CardTitle>
              <DollarSign className="h-4 w-4 text-primary hidden sm:block" />
            </CardHeader>
            <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">₹{(totalSales / 100000).toFixed(2)}L</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">{isWeddingPlanner ? 'Your events total' : '+20.1% from last month'}</p>
            </CardContent>
          </Card>
        )}

        <Card className="border-l-4 border-l-chart-2 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              {isWeddingPlanner ? 'My Upcoming Events' : 'Upcoming Events'}
            </CardTitle>
            <Calendar className="h-4 w-4 text-chart-2 hidden sm:block" />
          </CardHeader>
          <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{upcomingEvents}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Next 30 days</p>
          </CardContent>
        </Card>

        {isSuperAdmin && (
          <>
            <Card className="border-l-4 border-l-chart-3 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Active Leads
                </CardTitle>
                <Users className="h-4 w-4 text-chart-3 hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <div className="text-xl sm:text-2xl font-bold">12</div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">+2 new today</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-chart-4 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Monthly Profit
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-chart-4 hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <div className="text-xl sm:text-2xl font-bold">18%</div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">+2.5% from target</p>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-chart-5 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-6 sm:pb-2">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                  Inventory Value
                </CardTitle>
                <Package className="h-4 w-4 text-chart-5 hidden sm:block" />
              </CardHeader>
              <CardContent className="p-3 pt-0 sm:p-6 sm:pt-0">
                <div className="text-xl sm:text-2xl font-bold">₹{(totalInventoryValue / 100000).toFixed(2)}L</div>
                <p className="text-[10px] sm:text-xs text-muted-foreground">{inventoryItems.length} items in stock</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Quick Access Section */}
      <div>
        <h2 className="text-lg sm:text-xl font-serif font-semibold text-primary mb-4">Quick Access</h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {accessiblePages.map((page) => {
            const Icon = page.icon;
            return (
              <Link key={page.id} href={page.path}>
                <Card 
                  className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 hover:-translate-y-1 group"
                  data-testid={`quick-access-${page.id}`}
                >
                  <CardContent className="p-4 sm:p-5 flex flex-col items-center text-center gap-2 sm:gap-3">
                    <div className="p-2 sm:p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-xs sm:text-sm">{page.label}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 hidden sm:block">{page.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:gap-8 grid-cols-1 md:grid-cols-2">
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="font-serif text-lg sm:text-xl">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
            <div className="space-y-3 sm:space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-start gap-3 sm:gap-4 pb-3 sm:pb-4 border-b last:border-0 last:pb-0">
                  <div className="h-2 w-2 mt-2 rounded-full bg-primary flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium">New event created</p>
                    <p className="text-xs text-muted-foreground">2 hours ago</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="font-serif text-lg sm:text-xl">Upcoming Schedule</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
             <div className="space-y-3 sm:space-y-4">
              {events
                .filter(e => new Date(e.date) >= new Date(new Date().toDateString()))
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                .slice(0, 3)
                .map((e) => (
                <div key={e.id} className="flex items-center justify-between p-2 sm:p-3 bg-muted/30 rounded-lg gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                  </div>
                  <div className="text-[10px] sm:text-xs font-medium px-2 py-1 rounded bg-primary/10 text-primary capitalize flex-shrink-0">
                    {e.type}
                  </div>
                </div>
              ))}
              {events.filter(e => new Date(e.date) >= new Date(new Date().toDateString())).length === 0 && (
                <p className="text-center py-4 text-muted-foreground text-sm">No upcoming events</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

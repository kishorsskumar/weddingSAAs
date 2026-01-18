import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  LayoutDashboard, 
  Database, 
  DollarSign, 
  Target, 
  Package,
  Calendar,
  TrendingUp,
  Users,
  AlertCircle,
  CheckCircle,
  Clock,
  Receipt,
  Banknote
} from "lucide-react";
import type { Event } from "@/lib/types";

interface Lead {
  id: number;
  status: string;
  leadValue?: string;
}

interface Invoice {
  id: number;
  status: string;
  total: string;
  amountPaid?: string;
}

interface DaybookEntry {
  id: number;
  type: string;
  amount: string;
  date: string;
}

interface InventoryItem {
  id: number;
  name: string;
  quantity: number;
}

export default function ManagementMIS() {
  const [location, setLocation] = useLocation();
  const urlParams = new URLSearchParams(window.location.search);
  const tabFromUrl = urlParams.get('tab') || 'overview';
  const [activeTab, setActiveTab] = useState(tabFromUrl);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') || 'overview';
    setActiveTab(tab);
  }, [location]);

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ['/api/events'],
  });

  const { data: leads = [] } = useQuery<Lead[]>({
    queryKey: ['/api/leads'],
  });

  const { data: invoices = [] } = useQuery<Invoice[]>({
    queryKey: ['/api/invoices'],
  });

  const { data: daybook = [] } = useQuery<DaybookEntry[]>({
    queryKey: ['/api/daybook'],
  });

  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory/items'],
  });

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const next30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const today = now.toISOString().split('T')[0];

  const eventsThisMonth = events.filter(e => {
    const eventDate = new Date(e.date);
    return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
  });

  const upcomingEvents = events.filter(e => {
    const eventDate = new Date(e.date);
    return eventDate >= now && eventDate <= next30Days;
  });

  const eventsToday = events.filter(e => {
    const eventDate = new Date(e.date).toISOString().split('T')[0];
    return eventDate === today;
  });

  const totalRevenue = events
    .filter(e => {
      const eventDate = new Date(e.date);
      return eventDate.getMonth() === currentMonth && eventDate.getFullYear() === currentYear;
    })
    .reduce((sum, e) => sum + (parseFloat(e.amountReceived || '0') || 0), 0);

  const pendingPayments = events.reduce((sum, e) => {
    const total = parseFloat(e.totalAmount || '0') || 0;
    const received = parseFloat(e.amountReceived || '0') || 0;
    return sum + Math.max(0, total - received);
  }, 0);

  const activeLeads = leads.filter(l => l.status !== 'converted' && l.status !== 'lost').length;

  const totalInvoiceValue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);
  const receivedPayments = invoices.reduce((sum, inv) => sum + (parseFloat(inv.amountPaid || '0') || 0), 0);
  const outstandingAmount = totalInvoiceValue - receivedPayments;

  const totalExpenses = daybook
    .filter(entry => entry.type === 'expense')
    .reduce((sum, entry) => sum + (parseFloat(entry.amount) || 0), 0);

  const totalLeads = leads.length;
  const convertedLeads = leads.filter(l => l.status === 'converted').length;
  const conversionRate = totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : '0';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: LayoutDashboard },
    { id: "events", label: "Event Database", icon: Database },
    { id: "financial", label: "Financial Summary", icon: DollarSign },
    { id: "sales", label: "Sales Performance", icon: Target },
    { id: "operations", label: "Operations Snapshot", icon: Package },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="border-b bg-white px-4 py-3">
        <h1 className="text-xl font-semibold text-foreground">Management MIS</h1>
        <p className="text-sm text-muted-foreground">Executive dashboard and business intelligence</p>
      </div>

      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <div className="border-b bg-white px-4">
            <TabsList className="h-12 bg-transparent gap-1">
              {tabs.map(tab => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger 
                    key={tab.id} 
                    value={tab.id}
                    className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary px-4"
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </div>

          <div className="p-4 sm:p-6">
            <TabsContent value="overview" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Events This Month
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{eventsThisMonth.length}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Upcoming (30 days)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{upcomingEvents.length}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Monthly Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(totalRevenue)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Pending Payments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600">{formatCurrency(pendingPayments)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Active Leads
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{activeLeads}</div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Upcoming Events</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {upcomingEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No upcoming events in the next 30 days</p>
                    ) : (
                      <div className="space-y-3">
                        {upcomingEvents.slice(0, 5).map(event => (
                          <div key={event.id} className="flex items-center justify-between py-2 border-b last:border-0">
                            <div>
                              <p className="font-medium text-sm">{event.title}</p>
                              <p className="text-xs text-muted-foreground">{event.customerName}</p>
                            </div>
                            <Badge variant="outline">
                              {new Date(event.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Quick Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Events (All Time)</span>
                      <span className="font-semibold">{events.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Leads</span>
                      <span className="font-semibold">{totalLeads}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Conversion Rate</span>
                      <span className="font-semibold">{conversionRate}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Inventory Items</span>
                      <span className="font-semibold">{inventoryItems.length}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="events" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Event Database</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Access the full event database for detailed records and management.
                  </p>
                  <a 
                    href="/database" 
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                  >
                    <Database className="w-4 h-4" />
                    Open Event Database
                  </a>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="financial" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Total Invoice Value
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalInvoiceValue)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Received Payments
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{formatCurrency(receivedPayments)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      Outstanding Amount
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-amber-600">{formatCurrency(outstandingAmount)}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Banknote className="w-4 h-4" />
                      Total Expenses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Financial Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm">Collection Rate</span>
                      <span className="font-semibold">
                        {totalInvoiceValue > 0 ? ((receivedPayments / totalInvoiceValue) * 100).toFixed(1) : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm">Net Position (Received - Expenses)</span>
                      <span className={`font-semibold ${receivedPayments - totalExpenses >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(receivedPayments - totalExpenses)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sales" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Total Leads
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalLeads}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Converted Leads
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-green-600">{convertedLeads}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Conversion Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{conversionRate}%</div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Lead Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'converted', 'lost'].map(status => {
                      const count = leads.filter(l => l.status === status).length;
                      const percentage = totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(1) : 0;
                      return (
                        <div key={status} className="flex items-center justify-between py-2 border-b last:border-0">
                          <span className="text-sm capitalize">{status}</span>
                          <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full" 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-sm font-medium w-12 text-right">{count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="operations" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Events Today
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{eventsToday.length}</div>
                    {eventsToday.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {eventsToday.map(e => (
                          <p key={e.id} className="text-xs text-muted-foreground truncate">{e.title}</p>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Inventory Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{inventoryItems.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Total items in stock</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Active Events
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{upcomingEvents.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">Next 30 days</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Today's Schedule</CardTitle>
                </CardHeader>
                <CardContent>
                  {eventsToday.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No events scheduled for today</p>
                  ) : (
                    <div className="space-y-3">
                      {eventsToday.map(event => (
                        <div key={event.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium text-sm">{event.title}</p>
                            <p className="text-xs text-muted-foreground">{event.venue || 'Venue TBD'}</p>
                          </div>
                          <Badge>{event.eventType || 'Event'}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}

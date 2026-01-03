import { Switch, Route, useLocation } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/context/auth-context";
import Layout from "@/components/layout";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import EventCalendar from "@/pages/event-calendar";
import TeamCalendar from "@/pages/team-calendar";
import EventDatabase from "@/pages/event-database";
import EventMilestones from "@/pages/event-milestones";
import Daybook from "@/pages/daybook";
import OakBook from "@/pages/oak-book";
import HR from "@/pages/hr";
import Admin from "@/pages/admin";
import OakSales from "@/pages/oak-sales";
import OakInventory from "@/pages/oak-inventory";
import ExecutionPlan from "@/pages/execution-plan";
import CustomerPortal from "@/pages/customer-portal";
import PrintDocument from "@/pages/print-document";
import EmployeePortal from "@/pages/employee-portal";
import Oaksy from "@/pages/oaksy";
import OakCreative from "@/pages/oak-creative";
import MonthlyPlan from "@/pages/monthly-plan";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function PrivateRoute({ component: Component, path }: { component: any; path: string }) {
  const { user, isLoading } = useAuth();
  const [location, setLocation] = useLocation();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading || !user) return null; 

  return <Component />;
}

function AppRoutes() {
  return (
    <Layout>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/">
          <PrivateRoute component={Dashboard} path="/" />
        </Route>
        <Route path="/events">
          <PrivateRoute component={EventCalendar} path="/events" />
        </Route>
        <Route path="/monthly-plan">
          <PrivateRoute component={MonthlyPlan} path="/monthly-plan" />
        </Route>
        <Route path="/team">
           <PrivateRoute component={TeamCalendar} path="/team" />
        </Route>
        <Route path="/database">
           <PrivateRoute component={EventDatabase} path="/database" />
        </Route>
        <Route path="/milestones">
           <PrivateRoute component={EventMilestones} path="/milestones" />
        </Route>
        <Route path="/daybook">
           <PrivateRoute component={Daybook} path="/daybook" />
        </Route>
        <Route path="/oak-book">
           <PrivateRoute component={OakBook} path="/oak-book" />
        </Route>
        <Route path="/hr">
           <PrivateRoute component={HR} path="/hr" />
        </Route>
        <Route path="/admin">
           <PrivateRoute component={Admin} path="/admin" />
        </Route>
        <Route path="/oak-sales">
           <PrivateRoute component={OakSales} path="/oak-sales" />
        </Route>
        <Route path="/oak-inventory">
           <PrivateRoute component={OakInventory} path="/oak-inventory" />
        </Route>
        <Route path="/execution-plan">
           <PrivateRoute component={ExecutionPlan} path="/execution-plan" />
        </Route>
        <Route path="/employee-portal">
           <PrivateRoute component={EmployeePortal} path="/employee-portal" />
        </Route>
        <Route path="/oaksy">
           <PrivateRoute component={Oaksy} path="/oaksy" />
        </Route>
        <Route path="/oak-creative">
           <PrivateRoute component={OakCreative} path="/oak-creative" />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Switch>
            <Route path="/portal/:token">
              <CustomerPortal />
            </Route>
            <Route path="/print/:type/:id">
              <PrintDocument />
            </Route>
            <Route>
              <AppRoutes />
            </Route>
          </Switch>
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;

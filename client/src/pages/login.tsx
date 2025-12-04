import { useAuth } from "@/context/auth-context";
import { MOCK_USERS } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Shield, User, Briefcase } from "lucide-react";
import { useLocation } from "wouter";
import { useEffect } from "react";
import logo from "@assets/oakstreet_white_1764858814551.png";

export default function Login() {
  const { login, user, isLoading } = useAuth();
  const [_, setLocation] = useLocation();

  useEffect(() => {
    if (user) setLocation("/");
  }, [user, setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-0 shadow-2xl rounded-3xl overflow-hidden bg-card border border-border/50">
        {/* Left Side - Brand */}
        <div className="bg-sidebar p-12 flex flex-col justify-between text-sidebar-foreground relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=1000')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
          <div className="relative z-10">
            <img src={logo} alt="Oak Event" className="h-24 w-auto mb-4" />
            <p className="text-sidebar-foreground/80 text-lg">Management System</p>
          </div>
          <div className="relative z-10">
            <blockquote className="border-l-2 border-sidebar-primary pl-4 italic text-sidebar-foreground/70">
              "Excellence is not a skill, it's an attitude."
            </blockquote>
          </div>
        </div>

        {/* Right Side - Login Options */}
        <div className="p-12 flex flex-col justify-center">
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-2xl font-bold text-foreground font-serif mb-2">Welcome Back</h2>
            <p className="text-muted-foreground">Select a demo account to sign in.</p>
          </div>

          <div className="space-y-4">
            {MOCK_USERS.map((u) => (
              <Button
                key={u.id}
                variant="outline"
                className="w-full h-auto py-4 px-6 justify-between hover:border-primary/50 hover:bg-primary/5 group transition-all"
                onClick={() => login(u.id)}
                disabled={isLoading}
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                    {u.role === "admin" && <Shield className="h-5 w-5 text-primary" />}
                    {u.role === "manager" && <Briefcase className="h-5 w-5 text-primary" />}
                    {u.role === "employee" && <User className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="text-left">
                    <p className="font-semibold text-foreground">{u.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{u.role}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

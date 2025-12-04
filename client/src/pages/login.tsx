import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { useEffect, useState } from "react";
import logo from "@assets/oakstreet_white_1764858814551.png";

export default function Login() {
  const { login, user, isLoading } = useAuth();
  const [_, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (user) setLocation("/");
  }, [user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-0 shadow-2xl rounded-3xl overflow-hidden bg-card border border-border/50">
        {/* Left Side - Brand */}
        <div className="bg-sidebar p-12 flex flex-col justify-between text-sidebar-foreground relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=1000')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
          <div className="relative z-10">
            <img src={logo} alt="Oak Event" className="h-24 w-auto mb-4" />
            <p className="text-sidebar-foreground/80 text-lg">Crafting your Stories</p>
          </div>
          <div className="relative z-10">
            <blockquote className="border-l-2 border-sidebar-primary pl-4 italic text-sidebar-foreground/70">
              "Excellence is not a skill, it's an attitude."
            </blockquote>
          </div>
        </div>

        {/* Right Side - Login Form */}
        <div className="p-12 flex flex-col justify-center">
          <div className="mb-8 text-center md:text-left">
            <h2 className="text-2xl font-bold text-foreground font-serif mb-2">Welcome Back</h2>
            <p className="text-muted-foreground">Sign in to your account</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@oakevent.com"
                required
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                data-testid="input-password"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full" 
              disabled={isLoading}
              data-testid="button-login"
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
}

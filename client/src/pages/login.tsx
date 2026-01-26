import { useAuth } from "@/context/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation, Link } from "wouter";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Mail, Lock } from "lucide-react";
import { GlobalFooter } from "@/components/global-footer";

export default function Login() {
  const { login, user, isLoading } = useAuth();
  const [_, setLocation] = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) setLocation("/");
  }, [user, setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <div className="flex-1 flex items-center justify-center p-4">
      <motion.div 
        className="w-full max-w-5xl grid md:grid-cols-2 gap-0 shadow-2xl rounded-3xl overflow-hidden bg-card border border-border/50"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <motion.div 
          className="bg-sidebar p-12 flex flex-col justify-between text-sidebar-foreground relative overflow-hidden"
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1519167758481-83f550bb49b3?q=80&w=1000')] bg-cover bg-center opacity-10 mix-blend-overlay"></div>
          <motion.div 
            className="relative z-10"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.4 }}
          >
            <div className="flex items-center gap-3 mb-4">
              <Building2 className="h-12 w-12" />
              <h1 className="text-3xl font-bold">Wedding SaaS</h1>
            </div>
            <p className="text-sidebar-foreground/80 text-lg">Your complete event management platform</p>
          </motion.div>
          <motion.div 
            className="relative z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.4 }}
          >
            <blockquote className="border-l-2 border-sidebar-primary pl-4 italic text-sidebar-foreground/70">
              "Excellence is not a skill, it's an attitude."
            </blockquote>
          </motion.div>
        </motion.div>

        <motion.div 
          className="p-12 flex flex-col justify-center"
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
        >
          <motion.div 
            className="mb-8 text-center md:text-left"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.4 }}
          >
            <h2 className="text-2xl font-bold text-foreground mb-2">Welcome Back</h2>
            <p className="text-muted-foreground">Sign in to your account</p>
          </motion.div>

          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              {error}
            </div>
          )}

          <motion.form 
            onSubmit={handleSubmit} 
            className="space-y-4"
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: {
                opacity: 1,
                transition: { staggerChildren: 0.1, delayChildren: 0.6 }
              }
            }}
          >
            <motion.div 
              className="space-y-2"
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0 }
              }}
            >
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  data-testid="input-email"
                  className="pl-10 transition-all duration-200 focus:scale-[1.01]"
                />
              </div>
            </motion.div>
            <motion.div 
              className="space-y-2"
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0 }
              }}
            >
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  data-testid="input-password"
                  className="pl-10 transition-all duration-200 focus:scale-[1.01]"
                />
              </div>
            </motion.div>
            <motion.div
              variants={{
                hidden: { opacity: 0, y: 10 },
                visible: { opacity: 1, y: 0 }
              }}
            >
              <Button 
                type="submit" 
                className="w-full h-12 text-base font-medium transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
                disabled={submitting || isLoading}
                data-testid="button-login"
              >
                {submitting ? (
                  <motion.div
                    className="flex items-center gap-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Signing in...
                  </motion.div>
                ) : (
                  "Sign In"
                )}
              </Button>
            </motion.div>
          </motion.form>

          <motion.p 
            className="mt-6 text-center text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.4 }}
          >
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </motion.p>
        </motion.div>
      </motion.div>
      </div>
      <GlobalFooter />
    </div>
  );
}

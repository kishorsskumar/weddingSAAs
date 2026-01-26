import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { GlobalFooter } from "@/components/global-footer";
import { PublicNavbar } from "@/components/public-navbar";
import atbottLogo from "@/assets/atbott-logo.png";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || "Failed to send reset link");
      }
      
      setSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to send reset link");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      <PublicNavbar />
      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div 
          className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border/50 p-8"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <motion.div 
            className="text-center mb-8"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            <img src={atbottLogo} alt="AtBott" className="h-12 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-foreground mb-2">Reset your password</h2>
            <p className="text-muted-foreground text-sm">
              Enter your registered email address to receive a reset link
            </p>
          </motion.div>

          {success ? (
            <motion.div
              className="text-center py-6"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">Check your email</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Password reset link has been sent to your email
              </p>
              <Link href="/login">
                <Button variant="outline" className="gap-2" data-testid="link-back-to-login">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Login
                </Button>
              </Link>
            </motion.div>
          ) : (
            <>
              {error && (
                <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
                  {error}
                </div>
              )}

              <motion.form 
                onSubmit={handleSubmit} 
                className="space-y-4"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
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
                      className="pl-10"
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 text-base font-medium"
                  disabled={submitting}
                  data-testid="button-send-reset"
                >
                  {submitting ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </div>
                  ) : (
                    "Send Reset Link"
                  )}
                </Button>
              </motion.form>

              <motion.div 
                className="mt-6 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <Link 
                  href="/login" 
                  className="text-sm text-muted-foreground hover:text-primary hover:underline transition-colors inline-flex items-center gap-1"
                  data-testid="link-back-login"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Back to Login
                </Link>
              </motion.div>
            </>
          )}
        </motion.div>
      </div>
      <GlobalFooter />
    </div>
  );
}

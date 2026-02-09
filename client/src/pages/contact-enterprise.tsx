import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PublicNavbar } from "@/components/public-navbar";
import { PublicFooter } from "@/components/public-footer";
import { motion } from "framer-motion";
import { ArrowRight, Building2, CheckCircle2, Loader2, Shield, Users, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function ContactEnterprise() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    companyName: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    teamSize: "",
    eventsPerMonth: "",
    integrationNeeds: "",
    whatsappVolume: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/enterprise-leads", form);
      setSubmitted(true);
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col bg-white">
        <PublicNavbar />
        <section className="py-24 lg:py-32 flex-1 flex items-center">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="w-20 h-20 bg-cyan-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-cyan-100">
                <CheckCircle2 className="h-10 w-10 text-[#2FA4BC]" />
              </div>
              <h1 className="text-3xl font-bold text-slate-800 mb-4" data-testid="text-enterprise-success">Thank You!</h1>
              <p className="text-lg text-slate-500 mb-10">Our enterprise team will reach out within 24 hours to discuss your requirements.</p>
              <Button onClick={() => setLocation("/")} className="bg-[#2FA4BC] hover:bg-[#2590a6] shadow-md shadow-[#2FA4BC]/20 text-white font-semibold" data-testid="button-back-home">
                Back to Home
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </motion.div>
          </div>
        </section>
        <PublicFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicNavbar />

      <section className="py-16 lg:py-24 bg-white flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6" data-testid="text-enterprise-title">
                Enterprise Solutions
              </h1>
              <p className="text-lg text-gray-500 mb-8">
                For large agencies and teams that need custom integrations, dedicated support, and enterprise-grade security.
              </p>

              <div className="space-y-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-cyan-100">
                    <Users className="h-5 w-5 text-[#2FA4BC]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">Unlimited Team Members</h3>
                    <p className="text-sm text-slate-500">Scale your team without limits</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-cyan-100">
                    <Zap className="h-5 w-5 text-[#2FA4BC]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">WhatsApp & API Access</h3>
                    <p className="text-sm text-slate-500">Full integration capabilities</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-cyan-100">
                    <Shield className="h-5 w-5 text-[#2FA4BC]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800">SLA & Dedicated Support</h3>
                    <p className="text-sm text-slate-500">Priority assistance with guaranteed uptime</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-cyan-50 rounded-lg flex items-center justify-center flex-shrink-0 border border-cyan-100">
                    <Building2 className="h-5 w-5 text-[#2FA4BC]" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Multi-Branch Management</h3>
                    <p className="text-sm text-gray-500">Manage multiple locations from one account</p>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}>
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Contact Enterprise Sales</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="ent-company">Company Name *</Label>
                    <Input id="ent-company" value={form.companyName} onChange={(e) => update("companyName", e.target.value)} required data-testid="input-ent-company" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="ent-name">Your Name</Label>
                      <Input id="ent-name" value={form.contactName} onChange={(e) => update("contactName", e.target.value)} data-testid="input-ent-name" />
                    </div>
                    <div>
                      <Label htmlFor="ent-email">Email</Label>
                      <Input id="ent-email" type="email" value={form.contactEmail} onChange={(e) => update("contactEmail", e.target.value)} data-testid="input-ent-email" />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="ent-phone">Phone</Label>
                    <Input id="ent-phone" type="tel" value={form.contactPhone} onChange={(e) => update("contactPhone", e.target.value)} data-testid="input-ent-phone" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Team Size</Label>
                      <Select value={form.teamSize} onValueChange={(v) => update("teamSize", v)}>
                        <SelectTrigger data-testid="select-ent-team-size">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5-10">5-10</SelectItem>
                          <SelectItem value="11-25">11-25</SelectItem>
                          <SelectItem value="26-50">26-50</SelectItem>
                          <SelectItem value="50+">50+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Events/Month</Label>
                      <Select value={form.eventsPerMonth} onValueChange={(v) => update("eventsPerMonth", v)}>
                        <SelectTrigger data-testid="select-ent-events">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-5">1-5</SelectItem>
                          <SelectItem value="6-15">6-15</SelectItem>
                          <SelectItem value="16-30">16-30</SelectItem>
                          <SelectItem value="30+">30+</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="ent-integrations">Integration Needs</Label>
                    <Textarea id="ent-integrations" value={form.integrationNeeds} onChange={(e) => update("integrationNeeds", e.target.value)} placeholder="WhatsApp, CRM, accounting software, etc." rows={3} data-testid="input-ent-integrations" />
                  </div>
                  <div>
                    <Label>WhatsApp Usage Volume</Label>
                    <Select value={form.whatsappVolume} onValueChange={(v) => update("whatsappVolume", v)}>
                      <SelectTrigger data-testid="select-ent-whatsapp">
                        <SelectValue placeholder="Expected monthly messages" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="<500">Less than 500</SelectItem>
                        <SelectItem value="500-2000">500-2,000</SelectItem>
                        <SelectItem value="2000-10000">2,000-10,000</SelectItem>
                        <SelectItem value="10000+">10,000+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" className="w-full bg-[#2FA4BC] hover:bg-[#2590a6] shadow-lg shadow-[#2FA4BC]/20 text-white font-semibold" disabled={isSubmitting} data-testid="button-submit-enterprise">
                    {isSubmitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
                    ) : (
                      <>Contact Sales<ArrowRight className="ml-2 h-4 w-4" /></>
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

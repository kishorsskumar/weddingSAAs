import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PublicNavbar } from "@/components/public-navbar";
import { PublicFooter } from "@/components/public-footer";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function DemoPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    companyName: "",
    email: "",
    phone: "",
    businessType: "",
    preferredDate: "",
    preferredTime: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/demo-bookings", form);
      setLocation("/demo-confirmation");
    } catch (err: any) {
      toast({ title: "Something went wrong", description: err.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const update = (key: string, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicNavbar />

      <section className="py-16 lg:py-24 bg-white flex-1">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <h1 className="text-3xl sm:text-4xl font-bold text-slate-800 mb-6" data-testid="text-demo-title">
                Book a Personalized Demo
              </h1>
              <p className="text-lg text-gray-500 mb-8">
                See how Atbott can help you close more event clients and streamline your operations. Our team will walk you through every feature.
              </p>

              <ul className="space-y-4 mb-8">
                <li className="flex items-center gap-3 text-gray-600">
                  <CheckCircle2 className="h-5 w-5 text-[#2FA4BC] flex-shrink-0" />
                  30-minute personalized walkthrough
                </li>
                <li className="flex items-center gap-3 text-slate-600">
                  <CheckCircle2 className="h-5 w-5 text-[#2FA4BC] flex-shrink-0" />
                  See features tailored to your business
                </li>
                <li className="flex items-center gap-3 text-slate-600">
                  <CheckCircle2 className="h-5 w-5 text-[#2FA4BC] flex-shrink-0" />
                  Get answers to all your questions
                </li>
                <li className="flex items-center gap-3 text-slate-600">
                  <CheckCircle2 className="h-5 w-5 text-[#2FA4BC] flex-shrink-0" />
                  No commitment required
                </li>
              </ul>

              <div className="bg-cyan-50 rounded-xl p-6 border border-cyan-100">
                <h3 className="font-semibold text-gray-900 mb-2">What to expect</h3>
                <p className="text-sm text-gray-500">
                  After submitting your request, our team will confirm your preferred time slot within 24 hours. The demo will be conducted over Google Meet or Zoom.
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
                <h3 className="text-xl font-bold text-gray-900 mb-6">Schedule Your Demo</h3>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="demo-name">Your Name *</Label>
                    <Input id="demo-name" value={form.name} onChange={(e) => update("name", e.target.value)} required data-testid="input-demo-name" />
                  </div>
                  <div>
                    <Label htmlFor="demo-company">Company Name *</Label>
                    <Input id="demo-company" value={form.companyName} onChange={(e) => update("companyName", e.target.value)} required data-testid="input-demo-company" />
                  </div>
                  <div>
                    <Label htmlFor="demo-email">Email *</Label>
                    <Input id="demo-email" type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required data-testid="input-demo-email" />
                  </div>
                  <div>
                    <Label htmlFor="demo-phone">Phone *</Label>
                    <Input id="demo-phone" type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)} required data-testid="input-demo-phone" />
                  </div>
                  <div>
                    <Label>Business Type</Label>
                    <Select value={form.businessType} onValueChange={(v) => update("businessType", v)}>
                      <SelectTrigger data-testid="select-demo-business-type">
                        <SelectValue placeholder="Select your business type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="wedding_planner">Wedding Planner</SelectItem>
                        <SelectItem value="event_company">Event Management Company</SelectItem>
                        <SelectItem value="photography">Photography Agency</SelectItem>
                        <SelectItem value="decor">Decor Company</SelectItem>
                        <SelectItem value="corporate">Corporate Events</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="demo-date">Preferred Date</Label>
                      <div className="relative">
                        <Input id="demo-date" type="date" value={form.preferredDate} onChange={(e) => update("preferredDate", e.target.value)} data-testid="input-demo-date" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="demo-time">Preferred Time</Label>
                      <Select value={form.preferredTime} onValueChange={(v) => update("preferredTime", v)}>
                        <SelectTrigger data-testid="select-demo-time">
                          <SelectValue placeholder="Select time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10:00 AM">10:00 AM</SelectItem>
                          <SelectItem value="11:00 AM">11:00 AM</SelectItem>
                          <SelectItem value="12:00 PM">12:00 PM</SelectItem>
                          <SelectItem value="2:00 PM">2:00 PM</SelectItem>
                          <SelectItem value="3:00 PM">3:00 PM</SelectItem>
                          <SelectItem value="4:00 PM">4:00 PM</SelectItem>
                          <SelectItem value="5:00 PM">5:00 PM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button type="submit" className="w-full bg-[#2FA4BC] hover:bg-[#2590a6] shadow-lg shadow-[#2FA4BC]/20 text-white font-semibold" disabled={isSubmitting} data-testid="button-submit-demo">
                    {isSubmitting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
                    ) : (
                      <>Schedule Demo<ArrowRight className="ml-2 h-4 w-4" /></>
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

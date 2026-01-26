import { useEffect, useState } from "react";
import { PublicLayout } from "@/components/public-layout";
import { Link } from "wouter";
import { MapPin, Phone, Mail, Building2, Send, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function ContactPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: ""
  });

  useEffect(() => {
    document.title = "Contact Us | AtBott Wedding SaaS";
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    toast({
      title: "Message Sent!",
      description: "We'll get back to you within 24 hours.",
    });
    
    setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
    setIsSubmitting(false);
  };

  return (
    <PublicLayout>
      <div className="max-w-6xl mx-auto px-6 py-12 sm:px-8 sm:py-16">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
        
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">Contact Us</h1>
        <p className="text-gray-600 mb-8">
          We'd love to hear from you. Get in touch with us for any questions, support, or inquiries.
        </p>

        <div className="grid lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            <section className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <Building2 className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Company Name</h2>
                  <p className="text-gray-700 text-lg">Atbott Solutions</p>
                </div>
              </div>
            </section>

            <section className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <MapPin className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Office Address</h2>
                  <address className="text-gray-700 not-italic leading-relaxed">
                    69/1854 A1, InnerSpace,<br />
                    SRM Road, Kaloor,<br />
                    Kochi, Kerala – 682018<br />
                    India
                  </address>
                </div>
              </div>
            </section>

            <section className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <Phone className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Phone</h2>
                  <a 
                    href="tel:+918089191221" 
                    className="text-gray-700 text-lg hover:text-primary transition-colors"
                  >
                    +91 8089191221
                  </a>
                </div>
              </div>
            </section>

            <section className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <Mail className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 mb-2">Email</h2>
                  <a 
                    href="mailto:sales@atbott.co" 
                    className="text-gray-700 text-lg hover:text-primary transition-colors"
                  >
                    sales@atbott.co
                  </a>
                </div>
              </div>
            </section>

            <section className="bg-gray-50 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Business Hours</h2>
              <p className="text-gray-700">
                Monday to Friday: 9:00 AM - 6:00 PM IST<br />
                Saturday: 10:00 AM - 2:00 PM IST<br />
                Sunday: Closed
              </p>
            </section>

            <section className="rounded-lg overflow-hidden border border-gray-200">
              <div className="bg-gray-100 h-64 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Map Location</p>
                  <p className="text-xs">Kaloor, Kochi, Kerala</p>
                </div>
              </div>
            </section>
          </div>

          <div>
            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm sticky top-24">
              <h2 className="text-xl font-semibold text-gray-900 mb-6">Send us a Message</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="name">Full Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Your name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="you@example.com"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="How can we help?"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Tell us more about your inquiry..."
                    rows={5}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    "Sending..."
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send Message
                    </>
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

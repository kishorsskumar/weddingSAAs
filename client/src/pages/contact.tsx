import { useEffect } from "react";
import { PublicPageLayout } from "@/components/public-page-layout";
import { GlobalFooter } from "@/components/global-footer";
import { MapPin, Phone, Mail, Building2 } from "lucide-react";

export default function ContactPage() {
  useEffect(() => {
    document.title = "Contact Us | Atbott Solutions";
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicPageLayout title="Contact Us">
        <p className="text-gray-600 mb-8">
          We'd love to hear from you. Get in touch with us for any questions, support, or inquiries.
        </p>

        <div className="space-y-8">
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
                  Atbott Solutions<br />
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
            <div className="flex items-start gap-4">
              <Building2 className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Business Type</h2>
                <p className="text-gray-700">
                  SaaS Platform Provider for Wedding Planning Businesses
                </p>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-12 pt-8 border-t border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Business Hours</h2>
          <p className="text-gray-700">
            Monday to Friday: 9:00 AM - 6:00 PM IST<br />
            Saturday: 10:00 AM - 2:00 PM IST<br />
            Sunday: Closed
          </p>
        </section>
      </PublicPageLayout>
      <GlobalFooter />
    </div>
  );
}

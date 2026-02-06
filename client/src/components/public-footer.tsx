import { Link } from "wouter";
import { Mail, Phone, MapPin, Twitter, Linkedin, Instagram, Facebook, Youtube } from "lucide-react";
import atbottLogoDark from "@/assets/atbott-logo-dark.png";

export function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#1a3a42] text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          <div className="col-span-1 lg:col-span-2">
            <div className="flex items-center mb-4">
              <img src={atbottLogoDark} alt="Atbott" className="h-16 object-contain" />
            </div>
            <p className="text-sm text-gray-400 max-w-sm mb-6">
              All-in-one CRM, Client Portal, and Event Calendar for event planners and wedding businesses. Close more clients, deliver better events.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://twitter.com/atbott" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors">
                <Twitter className="h-5 w-5" />
              </a>
              <a href="https://linkedin.com/company/atbott" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors">
                <Linkedin className="h-5 w-5" />
              </a>
              <a href="https://instagram.com/atbott.co" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors">
                <Instagram className="h-5 w-5" />
              </a>
              <a href="https://facebook.com/atbott" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors">
                <Facebook className="h-5 w-5" />
              </a>
              <a href="https://youtube.com/@atbott" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors">
                <Youtube className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Product</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/#product" className="hover:text-white transition-colors">Features</Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
              </li>
              <li>
                <Link href="/demo" className="hover:text-white transition-colors">Book Demo</Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-white transition-colors">Start Free Trial</Link>
              </li>
              <li>
                <Link href="/knotvite" className="hover:text-white transition-colors">KnotVite RSVP</Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Legal</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="/privacy-policy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms & Conditions
                </Link>
              </li>
              <li>
                <Link href="/refund-policy" className="hover:text-white transition-colors">
                  Refund Policy
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Contact</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-[#2FA4BC]/60" />
                <a href="mailto:sales@atbott.co" className="hover:text-white transition-colors">
                  sales@atbott.co
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-[#2FA4BC]/60" />
                <a href="tel:+918089191221" className="hover:text-white transition-colors">
                  +91 8089191221
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-[#2FA4BC]/60 mt-0.5" />
                <span className="text-gray-400">
                  Kochi, Kerala, India
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-500">
            © {currentYear} Atbott Solutions Pvt Ltd. All rights reserved.
          </p>
          <p className="text-sm text-gray-500">
            Made with love in India
          </p>
        </div>
      </div>
    </footer>
  );
}

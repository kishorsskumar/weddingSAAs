import { Link } from "wouter";
import atbottLogoDark from "@/assets/atbott-logo-dark.png";

export function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center mb-4">
              <img src={atbottLogoDark} alt="AtBott" className="h-16 object-contain" />
            </div>
            <p className="text-sm text-gray-400 max-w-md">
              All-in-one platform to manage clients, events, vendors, payments and automation 
              for wedding planning businesses.
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/" className="hover:text-white transition-colors">Home</Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition-colors">Pricing</Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-white transition-colors">Contact</Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Legal</h3>
            <ul className="space-y-2 text-sm">
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
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-400">
            © {currentYear} Atbott Solutions. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-sm">
            <a href="mailto:sales@atbott.co" className="hover:text-white transition-colors">
              sales@atbott.co
            </a>
            <a href="tel:+918089191221" className="hover:text-white transition-colors">
              +91 8089191221
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}

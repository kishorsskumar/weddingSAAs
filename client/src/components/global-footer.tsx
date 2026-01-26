import { Link } from "wouter";

export function GlobalFooter() {
  return (
    <footer className="w-full py-6 px-4 border-t border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 text-sm text-gray-500">
          <Link href="/privacy-policy" className="hover:text-gray-700 transition-colors">
            Privacy Policy
          </Link>
          <span className="hidden sm:inline text-gray-300">|</span>
          <Link href="/terms" className="hover:text-gray-700 transition-colors">
            Terms
          </Link>
          <span className="hidden sm:inline text-gray-300">|</span>
          <Link href="/refund-policy" className="hover:text-gray-700 transition-colors">
            Refund Policy
          </Link>
          <span className="hidden sm:inline text-gray-300">|</span>
          <Link href="/contact" className="hover:text-gray-700 transition-colors">
            Contact
          </Link>
        </div>
        <p className="text-center text-xs text-gray-400 mt-4">
          © {new Date().getFullYear()} Atbott Solutions. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

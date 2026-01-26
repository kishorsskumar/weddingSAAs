import { useEffect } from "react";
import { PublicPageLayout } from "@/components/public-page-layout";
import { GlobalFooter } from "@/components/global-footer";

export default function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = "Privacy Policy | Atbott Solutions";
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicPageLayout title="Privacy Policy">
        <p className="text-gray-600 mb-8">
          Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
          <p className="text-gray-700 mb-4">
            We collect information you provide directly to us when you create an account, subscribe to our services, 
            or contact us for support. This includes:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Name and email address</li>
            <li>Company/business information</li>
            <li>Billing and payment information</li>
            <li>Communication preferences</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Data and Usage Data</h2>
          <p className="text-gray-700 mb-4">
            When you use our SaaS platform, we automatically collect certain information including:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Log data (IP address, browser type, pages visited)</li>
            <li>Device information</li>
            <li>Usage patterns and feature interactions</li>
            <li>Event and client data you enter into the platform</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Payment Processing</h2>
          <p className="text-gray-700">
            All payment processing is handled securely via <strong>Razorpay</strong>, a PCI-DSS compliant payment gateway. 
            We do not store your full credit card or bank details on our servers. Payment information is processed 
            and stored securely by Razorpay according to their privacy policy and security standards.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Cookies and Session Tracking</h2>
          <p className="text-gray-700">
            We use cookies and similar technologies to maintain your session, remember your preferences, 
            and improve your experience. Essential cookies are required for the platform to function properly. 
            You can manage cookie preferences through your browser settings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Data Security Practices</h2>
          <p className="text-gray-700">
            We implement industry-standard security measures to protect your data, including:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2 mt-4">
            <li>SSL/TLS encryption for data in transit</li>
            <li>Encrypted database storage</li>
            <li>Regular security audits</li>
            <li>Access controls and authentication</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Rights</h2>
          <p className="text-gray-700">
            You have the right to access, update, or delete your personal information. You may also request 
            a copy of your data or ask us to restrict processing. To exercise these rights, please contact us 
            at the email address below.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Us</h2>
          <p className="text-gray-700">
            For any privacy-related questions or concerns, please contact:
          </p>
          <p className="text-gray-700 mt-4">
            <strong>Atbott Solutions</strong><br />
            Email: <a href="mailto:sales@atbott.co" className="text-primary hover:underline">sales@atbott.co</a>
          </p>
        </section>
      </PublicPageLayout>
      <GlobalFooter />
    </div>
  );
}

import { useEffect } from "react";
import { PublicPageLayout } from "@/components/public-page-layout";
import { GlobalFooter } from "@/components/global-footer";

export default function TermsPage() {
  useEffect(() => {
    document.title = "Terms and Conditions | Atbott Solutions";
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicPageLayout title="Terms and Conditions">
        <p className="text-gray-600 mb-8">
          Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">SaaS Usage Rules</h2>
          <p className="text-gray-700 mb-4">
            By accessing and using our wedding planning SaaS platform, you agree to comply with these terms. 
            The platform is provided for legitimate business use by wedding planning professionals and businesses.
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Use the platform only for lawful purposes</li>
            <li>Do not attempt to gain unauthorized access to the system</li>
            <li>Do not upload malicious content or code</li>
            <li>Respect the intellectual property of others</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Account Responsibility</h2>
          <p className="text-gray-700">
            You are responsible for maintaining the confidentiality of your account credentials. 
            All activities that occur under your account are your responsibility. You must notify us 
            immediately of any unauthorized use of your account or any other security breach.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Subscription Billing Terms</h2>
          <p className="text-gray-700 mb-4">
            Our platform operates on a subscription basis with the following terms:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Subscriptions are billed monthly or annually as selected</li>
            <li>Payment is due at the start of each billing cycle</li>
            <li>Prices are in Indian Rupees (INR) unless otherwise specified</li>
            <li>We reserve the right to modify pricing with 30 days notice</li>
            <li>You may cancel your subscription at any time; service continues until the end of the billing period</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Service Availability</h2>
          <p className="text-gray-700">
            We strive to maintain 99.9% uptime but do not guarantee uninterrupted service. 
            The platform may be temporarily unavailable due to maintenance, updates, or circumstances 
            beyond our control. We are not liable for any losses arising from service interruptions.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Intellectual Property</h2>
          <p className="text-gray-700">
            The platform, including its design, features, and content, is the intellectual property 
            of Atbott Solutions. You retain ownership of the data you upload to the platform. 
            You grant us a license to use this data solely for providing the service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Termination</h2>
          <p className="text-gray-700">
            We reserve the right to terminate or suspend your account if you violate these terms. 
            Upon termination, your access to the platform will cease. You may request an export of 
            your data within 30 days of termination.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Governing Law</h2>
          <p className="text-gray-700">
            These terms are governed by the laws of India. Any disputes arising from these terms 
            shall be subject to the exclusive jurisdiction of the courts in Kochi, Kerala, India.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact</h2>
          <p className="text-gray-700">
            <strong>Atbott Solutions</strong><br />
            Email: <a href="mailto:sales@atbott.co" className="text-primary hover:underline">sales@atbott.co</a>
          </p>
        </section>
      </PublicPageLayout>
      <GlobalFooter />
    </div>
  );
}

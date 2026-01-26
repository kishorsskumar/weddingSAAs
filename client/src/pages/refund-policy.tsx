import { useEffect } from "react";
import { PublicLayout } from "@/components/public-layout";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function RefundPolicyPage() {
  useEffect(() => {
    document.title = "Refund Policy | AtBott Wedding SaaS";
  }, []);

  return (
    <PublicLayout>
      <div className="max-w-[800px] mx-auto px-6 py-12 sm:px-8 sm:py-16">
        <Link href="/">
          <Button variant="ghost" size="sm" className="mb-6 -ml-2 text-gray-600 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
        
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-8">Refund Policy</h1>
        
        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 mb-8">
            Last updated: {new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Digital SaaS Product</h2>
            <p className="text-gray-700">
              Our wedding planning SaaS platform is a digital software service. Due to the nature of 
              digital products and instant access upon subscription activation, our refund policy is 
              as follows:
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">No Refunds After Activation</h2>
            <p className="text-gray-700">
              Once your subscription is activated and you have access to the platform, <strong>no refunds 
              will be issued</strong>. By subscribing, you acknowledge that you have reviewed our features 
              and pricing, and agree to this policy.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Exceptions</h2>
            <p className="text-gray-700 mb-4">
              Refunds may be considered only in the following exceptional circumstances:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>Duplicate payments:</strong> If you were charged twice for the same subscription period</li>
              <li><strong>Technical billing errors:</strong> If there was a system error that resulted in incorrect charges</li>
            </ul>
            <p className="text-gray-700 mt-4">
              Such refund requests must be submitted <strong>within 48 hours</strong> of the transaction.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">How to Request a Refund</h2>
            <p className="text-gray-700 mb-4">
              If you believe you qualify for a refund under the exceptions above, please contact us with:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Your registered email address</li>
              <li>Transaction ID or payment reference</li>
              <li>Reason for the refund request</li>
              <li>Any supporting documentation</li>
            </ul>
            <p className="text-gray-700 mt-4">
              Send your request to: <a href="mailto:sales@atbott.co" className="text-primary hover:underline font-medium">sales@atbott.co</a>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Processing Time</h2>
            <p className="text-gray-700">
              Approved refunds will be processed within <strong>7 business days</strong>. The refund will be 
              credited to the original payment method used for the transaction. Please note that your 
              bank or payment provider may take additional time to reflect the refund in your account.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Cancellation</h2>
            <p className="text-gray-700">
              You may cancel your subscription at any time through your account settings. Upon cancellation, 
              you will continue to have access to the platform until the end of your current billing period. 
              No partial refunds are provided for unused portions of a billing period.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact Us</h2>
            <p className="text-gray-700">
              For any questions about our refund policy, please contact:
            </p>
            <p className="text-gray-700 mt-4">
              <strong>Atbott Solutions</strong><br />
              Email: <a href="mailto:sales@atbott.co" className="text-primary hover:underline">sales@atbott.co</a>
            </p>
          </section>
        </div>
      </div>
    </PublicLayout>
  );
}

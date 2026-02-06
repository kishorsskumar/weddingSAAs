import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { PublicNavbar } from "@/components/public-navbar";
import { PublicFooter } from "@/components/public-footer";
import { motion } from "framer-motion";
import { CheckCircle2, ArrowRight, Calendar, Mail } from "lucide-react";

export default function DemoConfirmation() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicNavbar />

      <section className="py-24 lg:py-32 flex-1 flex items-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
          >
            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8 border border-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>

            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4" data-testid="text-confirmation-title">
              Demo Request Submitted!
            </h1>
            <p className="text-lg text-gray-500 mb-10 max-w-lg mx-auto">
              Thank you for your interest in Atbott. Our team will confirm your demo slot within 24 hours.
            </p>

            <div className="bg-gray-50 rounded-xl p-6 mb-10 text-left space-y-4 max-w-md mx-auto">
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900 text-sm">Check your email</h3>
                  <p className="text-sm text-gray-500">We'll send a confirmation with meeting details</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h3 className="font-medium text-gray-900 text-sm">Calendar invite</h3>
                  <p className="text-sm text-gray-500">You'll receive a Google Meet or Zoom link</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/">
                <Button variant="outline" className="border-green-200 text-green-600 hover:bg-green-50" data-testid="button-back-home">
                  Back to Home
                </Button>
              </Link>
              <Link href="/signup?plan=growth">
                <Button className="bg-green-500 hover:bg-green-600 shadow-md shadow-green-500/20 text-white font-semibold" data-testid="button-start-trial">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}

import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Helmet } from "react-helmet-async";

export default function Terms() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Helmet>
        <title>Terms of Service | Doculoom</title>
        <meta name="description" content="Terms of Service for Doculoom." />
      </Helmet>

      <PublicHeader />

      <main className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-slate-900 mb-8">Terms of Service</h1>
        <div className="prose prose-slate max-w-none text-slate-600">
          <p className="mb-4">Last Updated: {new Date().toLocaleDateString()}</p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">1. Acceptance of Terms</h3>
          <p>
            By accessing or using Doculoom, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access the service.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">2. Subscriptions & Payments</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Billing:</strong> You agree to pay all fees associated with your chosen subscription plan. Payments are billed in advance on a recurring basis (monthly or annually).</li>
            <li><strong>Cancellation:</strong> You may cancel your subscription at any time via your account dashboard. Your access will continue until the end of the current billing cycle.</li>
            <li><strong>Refunds:</strong> We offer a 14-day money-back guarantee for first-time subscribers who are unsatisfied with the service.</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">3. User Content</h3>
          <p>
            You retain all rights to the data, files, and content you upload to Doculoom. By uploading content, you grant us a license to process and store it solely for the purpose of providing the service to you.
            You are responsible for ensuring you have the rights to use any images or data you upload.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">4. Acceptable Use</h3>
          <p>
            You agree not to use the service to generate illegal, offensive, or malicious content. We reserve the right to suspend accounts that violate this policy.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">5. Limitation of Liability</h3>
          <p>
            Doculoom is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">6. Contact</h3>
          <p>
            Questions about the Terms of Service should be sent to us at: <a href="mailto:support@doculoom.io" className="text-[#2A9D90]">support@doculoom.io</a>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
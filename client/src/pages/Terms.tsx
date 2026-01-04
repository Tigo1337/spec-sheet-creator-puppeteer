import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Helmet } from "react-helmet-async";

export default function Terms() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Helmet>
        <title>Terms of Service | Doculoom</title>
        <meta name="description" content="Terms of Service for Doculoom. Rules and guidelines for using our platform." />
      </Helmet>

      <PublicHeader />

      <main className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-slate-900 mb-8">Terms of Service</h1>
        <div className="prose prose-slate max-w-none text-slate-600">
          <p className="mb-4">Last Updated: {new Date().toLocaleDateString()}</p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">1. Acceptance of Terms</h3>
          <p>
            By accessing Doculoom, you agree to these Terms. If you are using the Service on behalf of an organization, you agree to these Terms for that organization.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">2. Subscriptions, Credits & Usage</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Subscription Plans:</strong> Features and limits (such as PDF export volume) vary by plan. We reserve the right to modify plan features at any time.</li>
            <li><strong>AI Credits:</strong> Certain plans include AI credits for data enrichment. These credits are non-transferable, have no cash value, and reset according to your billing cycle. Unused credits do not roll over.</li>
            <li><strong>Billing:</strong> Fees are non-refundable except as required by law or specified in our 14-day guarantee. All payments are processed via third-party providers.</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">3. User Content & Intellectual Property</h3>
          <p>
            You retain ownership of all data and images you upload. You grant us a worldwide, non-exclusive license to host, store, and process your content solely to provide the Service, including the maintenance of your "Product Knowledge" database.
          </p>
          <p>
            Doculoom retains all rights to the platform’s code, design templates, and proprietary document generation logic.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">4. Acceptable Use & AI Policy</h3>
          <p>You agree not to use Doculoom to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Generate content that violates local or international laws.</li>
            <li>Attempt to bypass usage limits, scrape the platform, or reverse-engineer AI features.</li>
            <li>Upload malicious code or content that infringes on third-party intellectual property.</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">5. Disclaimers & Service Limitations</h3>
          <p>
            <strong>"As Is" Basis:</strong> Doculoom is provided without warranties of any kind. We do not guarantee that document generation will be error-free or that the Service will be uninterrupted.
          </p>
          <p>
            <strong>AI Outputs:</strong> AI-generated content (enrichment, translation, formatting) is provided for convenience. We are not responsible for inaccuracies in AI-generated data; you are responsible for verifying all final document outputs.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">6. Termination</h3>
          <p>
            We reserve the right to suspend or terminate your access for non-payment, violation of these Terms, or at our sole discretion to protect the integrity of the Service.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">7. Contact</h3>
          <p>
            Questions should be sent to: <a href="mailto:support@doculoom.io" className="text-[#2A9D90]">support@doculoom.io</a>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
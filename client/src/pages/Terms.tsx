import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Helmet } from "react-helmet-async";

export default function Terms() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Helmet>
        <title>Terms of Service | Doculoom</title>
        <meta name="description" content="Terms of Service for Doculoom, a service provided by Livessa. Rules and guidelines for using our platform." />
      </Helmet>

      <PublicHeader />

      <main className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-slate-900 mb-8">Terms of Service</h1>
        <div className="prose prose-slate max-w-none text-slate-600">
          <p className="mb-4">Last Updated: {new Date().toLocaleDateString()}</p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">1. Acceptance of Terms</h3>
          <p>
            Doculoom is a service provided by Livessa, a company based in Quebec, Canada.
            By accessing or using Doculoom (the "Service"), you agree to be bound by these Terms of Service ("Terms").
            If you are using the Service on behalf of an organization, you represent and warrant that you have authority to bind
            that organization to these Terms.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">2. Subscriptions, Credits & Usage</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Subscription Plans:</strong> Features and limits (such as PDF export volume) vary by plan. We reserve the right to modify plan features at any time with reasonable notice.</li>
            <li><strong>AI Credits:</strong> Certain plans include AI credits for data enrichment. These credits are non-transferable, have no cash value, and reset according to your billing cycle. Unused credits do not roll over.</li>
            <li><strong>Billing:</strong> Fees are non-refundable except as required by law or specified in our 14-day guarantee. All payments are processed via third-party providers.</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">3. User Content & Intellectual Property</h3>
          <p>
            You retain ownership of all data and images you upload. You grant Livessa a worldwide, non-exclusive license to host, store, and process your content solely to provide the Service, including the maintenance of your "Product Knowledge" database.
          </p>
          <p>
            Livessa retains all rights to the platform's code, design templates, and proprietary document generation logic.
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
            <strong>"As Is" Basis:</strong> Doculoom is provided without warranties of any kind, whether express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, and non-infringement.
            We do not guarantee that document generation will be error-free or that the Service will be uninterrupted.
          </p>
          <p>
            <strong>AI Outputs:</strong> AI-generated content (enrichment, translation, formatting) is provided for convenience. We are not responsible for inaccuracies in AI-generated data; you are responsible for verifying all final document outputs.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">6. Limitation of Liability</h3>
          <p>
            To the maximum extent permitted by applicable law, Livessa, its officers, directors, employees, agents, and affiliates
            shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to
            loss of profits, data, business opportunities, or goodwill, arising out of or related to your use of or inability to use the Service,
            regardless of the theory of liability (contract, tort, strict liability, or otherwise), even if Livessa has been advised of the possibility of such damages.
          </p>
          <p>
            <strong>In no event shall Livessa's total aggregate liability to you for all claims arising out of or related to the Service
            exceed the total amount paid by you to Livessa during the twelve (12) months immediately preceding the event giving rise to the claim.</strong>
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">7. Indemnification</h3>
          <p>
            You agree to indemnify, defend, and hold harmless Livessa and its officers, directors, employees, and agents from and against
            any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or related to your
            use of the Service, your violation of these Terms, or your infringement of any third-party rights.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">8. Termination</h3>
          <p>
            We reserve the right to suspend or terminate your access for non-payment, violation of these Terms, or at our sole discretion
            to protect the integrity of the Service. Upon termination, your right to use the Service will immediately cease.
            Sections relating to intellectual property, limitation of liability, indemnification, and governing law shall survive termination.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">9. Governing Law & Dispute Resolution</h3>
          <p>
            These Terms are governed by and construed in accordance with the laws of the Province of Quebec and the federal laws of Canada
            applicable therein, without regard to conflict of law principles. Any dispute arising under these Terms shall be subject to the
            exclusive jurisdiction of the courts of the Province of Quebec. The parties agree to submit to the personal jurisdiction of such courts.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">10. Changes to Terms</h3>
          <p>
            We may update these Terms from time to time. We will notify you of material changes by posting the updated Terms on our website
            and updating the "Last Updated" date. Your continued use of the Service after such changes constitutes your acceptance of the revised Terms.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">11. Contact</h3>
          <p>
            Questions about these Terms should be sent to: <a href="mailto:privacy@doculoom.io" className="text-[#2A9D90]">privacy@doculoom.io</a>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Helmet } from "react-helmet-async";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Helmet>
        <title>Privacy Policy | Doculoom</title>
        <meta name="description" content="Privacy Policy for Doculoom. Compliant with Quebec Law 25, GDPR, and CCPA." />
      </Helmet>

      <PublicHeader />

      <main className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-slate-900 mb-8">Privacy Policy</h1>
        <div className="prose prose-slate max-w-none text-slate-600">
          <p className="mb-4 italic text-sm">Last Updated: {new Date().toLocaleDateString()}</p>

          {/* LAW 25 MANDATORY: PRIVACY OFFICER */}
          <section className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-8">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Data Protection Officer (Law 25)</h3>
            <p className="text-sm">
              In accordance with Quebec's Law 25, the person responsible for the protection of personal information at Doculoom is:
            </p>
            <ul className="text-sm mt-2 font-medium">
              <li>Name: The Privacy Officer</li>
              <li>Title: Chief Executive Officer & Privacy Officer</li>
              <li>Contact: <a href="mailto:privacy@doculoom.io" className="text-[#2A9D90]">privacy@doculoom.io</a></li>
            </ul>
          </section>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">1. Introduction</h3>
          <p>
            Doculoom is a product owned and operated by Livessa, a company based in Quebec, Canada.
            Livessa ("we," "our," or "us") is committed to protecting the privacy and security of your personal information.
            This policy is designed to comply with the <em>Act respecting the protection of personal information in the private sector</em> (Quebec Law 25),
            and we also recognize the rights afforded to individuals under international privacy frameworks, including
            the European Union's General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA).
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">2. Information We Collect</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Account & Profile:</strong> Name, email address, and authentication data.</li>
            <li><strong>User Content:</strong> Data files (CSV/Excel), images, and text provided for document generation.</li>
            <li><strong>AI Interaction Data:</strong> Prompts and inputs used for content generation.</li>
            <li><strong>Technical Data:</strong> IP addresses and cookies (we require explicit opt-in for non-essential cookies).</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">3. Data Location & Transfers</h3>
          <p>
            <strong>Personal information collected by Doculoom may be stored or processed on servers located outside of Quebec</strong>
            (for example, in the United States or other jurisdictions) via our cloud infrastructure and AI providers. In accordance with Quebec Law 25,
            we conduct Privacy Impact Assessments (PIA) to ensure that such transfers benefit from adequate protection.
            Where applicable, we implement appropriate safeguards such as standard contractual clauses or equivalent measures
            to protect your data during international transfers, consistent with GDPR requirements.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">4. Automated Processing & AI</h3>
          <p>
            When using our AI features, decisions regarding data standardisation may be automated. If Doculoom uses automated
            processing to make a decision that significantly affects you, we will inform you at the time of the decision.
            You have the right to request information on the factors and parameters used and the right to have that decision reviewed by a person.
            This right applies under Quebec Law 25, as well as under GDPR Article 22 for users in the European Economic Area.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">5. Data Retention & Destruction</h3>
          <p>
            We keep your personal information only as long as necessary for the purposes for which it was collected.
            Our governance framework includes strict protocols for the secure destruction of data once the retention period ends.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">6. Your Rights</h3>
          <p>Depending on your jurisdiction, you may have the following rights regarding your personal information:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Access:</strong> Request access to your personal data and obtain a copy of the information we hold about you.</li>
            <li><strong>Rectification:</strong> Request correction of inaccurate or incomplete personal information.</li>
            <li><strong>Erasure / Deletion:</strong> Request the deletion of your personal information, subject to applicable legal obligations.</li>
            <li><strong>Withdrawal of Consent:</strong> Withdraw consent for data processing at any time, without affecting the lawfulness of processing carried out prior to withdrawal.</li>
            <li><strong>Data Portability:</strong> Receive your data in a structured, commonly used, and machine-readable format, and transmit it to another controller.</li>
            <li><strong>Restriction of Processing:</strong> Request restriction of processing under certain circumstances (GDPR).</li>
            <li><strong>Opt-Out of Sale:</strong> Where applicable, opt out of the sale or sharing of your personal information (CCPA).</li>
            <li><strong>Non-Discrimination:</strong> Exercise your privacy rights without receiving discriminatory treatment (CCPA).</li>
          </ul>
          <p className="mt-4">
            These rights are provided under Quebec Law 25, and we extend equivalent protections to users regardless of location,
            in alignment with GDPR and CCPA principles.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">7. Contact</h3>
          <p>
            To exercise your rights, file a complaint, or inquire about our privacy practices, please contact our Privacy Officer
            at <a href="mailto:privacy@doculoom.io" className="text-[#2A9D90]">privacy@doculoom.io</a>. We will respond to all requests within 30 days.
            If you are not satisfied with our response, you may also file a complaint with the Commission d'accès à l'information du Québec (CAI)
            or, where applicable, your local data protection authority.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}

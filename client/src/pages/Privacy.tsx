import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Helmet } from "react-helmet-async";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Helmet>
        <title>Privacy Policy | Doculoom</title>
        <meta name="description" content="Privacy Policy for Doculoom. Law 25 & Bill 96 Compliant." />
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
              <li>Name: [Your Full Name]</li>
              <li>Title: Chief Executive Officer & Privacy Officer</li>
              <li>Contact: <a href="mailto:privacy@doculoom.io" className="text-[#2A9D90]">privacy@doculoom.io</a></li>
            </ul>
          </section>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">1. Introduction</h3>
          <p>
            Doculoom ("we," "our," or "us") is committed to protecting the privacy and security of your personal information. 
            This policy is designed to comply with the *Act respecting the protection of personal information in the private sector* (Quebec).
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">2. Information We Collect</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Account & Profile:</strong> Name, email address, and authentication data.</li>
            <li><strong>User Content:</strong> Data files (CSV/Excel), images, and text provided for document generation.</li>
            <li><strong>AI Interaction Data:</strong> Prompts and inputs used for content generation.</li>
            <li><strong>Technical Data:</strong> IP addresses and cookies (we require explicit opt-in for non-essential cookies).</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">3. Data Location & Transfers (Law 25 Requirement)</h3>
          <p>
            <strong>Personal information collected by Doculoom may be stored or processed on servers located outside of Quebec</strong> 
            (for example, in the United States) via our cloud infrastructure and AI providers. We conduct Privacy Impact Assessments (PIA) 
            to ensure that such transfers benefit from adequate protection.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">4. Automated Processing & AI</h3>
          <p>
            When using our AI features, decisions regarding data standardisation may be automated. If Doculoom uses automated 
            processing to make a decision that significantly affects you, we will inform you at the time of the decision. 
            You have the right to request information on the factors and parameters used and the right to have that decision reviewed by a person.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">5. Data Retention & Destruction</h3>
          <p>
            We keep your personal information only as long as necessary for the purposes for which it was collected. 
            Our governance framework includes strict protocols for the secure destruction of data once the retention period ends.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">6. Your Subject Rights</h3>
          <p>Under Quebec law, you have the following rights:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Access & Rectification:</strong> Request access to your data or correct inaccuracies.</li>
            <li><strong>Erasure:</strong> Request the deletion of your personal information.</li>
            <li><strong>Withdrawal of Consent:</strong> Withdraw consent for data processing at any time.</li>
            <li><strong>Data Portability:</strong> Receive your data in a structured, commonly used technological format.</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">7. Contact</h3>
          <p>
            To exercise your rights or file a complaint regarding our privacy practices, please contact our Privacy Officer 
            listed in the section above. We will respond to all requests within 30 days.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
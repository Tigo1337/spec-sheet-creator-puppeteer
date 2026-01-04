import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Helmet } from "react-helmet-async";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white font-sans">
      <Helmet>
        <title>Privacy Policy | Doculoom</title>
        <meta name="description" content="Privacy Policy for Doculoom. Learn how we handle your data." />
      </Helmet>

      <PublicHeader />

      <main className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-slate-900 mb-8">Privacy Policy</h1>
        <div className="prose prose-slate max-w-none text-slate-600">
          <p className="mb-4">Last Updated: {new Date().toLocaleDateString()}</p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">1. Introduction</h3>
          <p>
            Welcome to Doculoom ("we," "our," or "us"). We provide a platform for professional document generation and data enrichment. 
            This Privacy Policy describes how we handle information across our platform and services.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">2. Information We Collect</h3>
          <p>We collect information you provide directly and data generated through your use of the Service:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Account & Profile:</strong> Email address and authentication metadata provided during registration.</li>
            <li><strong>User Content:</strong> Data files (CSV/Excel), images, and text you upload for document generation.</li>
            <li><strong>AI Interaction Data:</strong> We log prompts and inputs used to generate content via our AI features to improve service delivery and track usage credits.</li>
            <li><strong>Usage Metadata:</strong> Information regarding document export history, scan counts for generated QR codes, and system logs.</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">3. How We Use Your Information</h3>
          <p>We process your information to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Operate and maintain your account and document workspace.</li>
            <li>Execute PDF generation and bulk export jobs.</li>
            <li>Provide AI-powered data enrichment and standardization.</li>
            <li>Process subscription billing and prevent fraudulent transactions.</li>
            <li>Maintain a "Product Knowledge" base for your account to streamline future document creation.</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">4. Third-Party Service Providers</h3>
          <p>
            We do not sell your data. We share information with a limited number of service providers who help us operate our business. 
            These providers are grouped into the following categories:
          </p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Authentication & Identity:</strong> To manage secure user logins.</li>
            <li><strong>Payment Processing:</strong> To handle secure billing (we do not store your full payment card details).</li>
            <li><strong>Cloud Infrastructure:</strong> For hosting, database management, and file storage.</li>
            <li><strong>AI Model Providers:</strong> To process your data enrichment requests.</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">5. Data Retention & Security</h3>
          <p>
            We implement industry-standard security measures to protect your data. Your content is stored for as long as your account is active 
            or as needed to provide you with the Service. You may delete your saved designs or product knowledge entries at any time via the user interface.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">6. Your Rights</h3>
          <p>
            Depending on your location, you may have the right to access, correct, or delete your personal data. 
            To exercise these rights, please contact our support team.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">7. Contact Us</h3>
          <p>
            If you have any questions about this Privacy Policy, please contact us at: 
            <a href="mailto:privacy@doculoom.io" className="text-[#2A9D90]"> privacy@doculoom.io</a>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
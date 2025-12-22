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
            Welcome to Doculoom ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your data. 
            This Privacy Policy explains how we collect, use, and safeguard your information when you use our website and services.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">2. Information We Collect</h3>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Account Information:</strong> When you sign up, we collect your email address and name via our authentication provider (Clerk).</li>
            <li><strong>User Content:</strong> We process the files you upload (Excel/CSV) and the images you add solely for the purpose of generating your documents. We do not use this data for marketing or share it with third parties.</li>
            <li><strong>Payment Information:</strong> All payments are processed securely by Stripe. We do not store your credit card information on our servers.</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">3. How We Use Your Information</h3>
          <p>We use your information to:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>Provide and maintain the Service (generating PDFs).</li>
            <li>Process your subscription payments.</li>
            <li>Notify you about changes to our Service.</li>
            <li>Provide customer support.</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">4. Data Storage & Security</h3>
          <p>
            Your data is stored securely using industry-standard encryption. We use Google Cloud Platform for storage and Replit for hosting. 
            While we strive to use commercially acceptable means to protect your Personal Data, we cannot guarantee its absolute security.
          </p>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">5. Third-Party Services</h3>
          <p>We may share data with the following trusted third-party service providers solely for the operation of our service:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Stripe:</strong> Payment processing.</li>
            <li><strong>Clerk:</strong> User authentication.</li>
            <li><strong>Google Cloud:</strong> Infrastructure and storage.</li>
          </ul>

          <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">6. Contact Us</h3>
          <p>
            If you have any questions about this Privacy Policy, please contact us at: <a href="mailto:privacy@doculoom.io" className="text-[#2A9D90]">privacy@doculoom.io</a>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
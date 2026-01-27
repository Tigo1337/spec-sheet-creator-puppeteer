import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer";
import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Factory,
  Building2,
  Users,
  Briefcase,
  CheckCircle2,
  ArrowRight,
  FileSpreadsheet,
  Printer,
  QrCode,
  Database,
  LayoutTemplate,
  Zap,
  ShoppingBag,
  Stethoscope,
  Utensils
} from "lucide-react";

export default function Solutions() {
  const [, setLocation] = useLocation();

  const handleFreeSignup = () => {
    sessionStorage.removeItem("checkoutPlan");
    sessionStorage.removeItem("checkoutPriceId");
    setLocation("/registration");
  };

  return (
    <div className="min-h-screen bg-matte text-slate-900 font-sans selection:bg-[#2A9D90]/20">
      <Helmet>
        <title>Solutions - For Agencies & Manufacturers | Doculoom</title>
        <meta name="description" content="Streamline document generation for retail, manufacturing, and agencies. Create data-driven spec sheets at scale." />
        <link rel="canonical" href="https://doculoom.io/solutions" />
      </Helmet>

      <PublicHeader />

      <main className="space-y-32 mb-24">

        {/* Hero Section */}
        <section className="relative overflow-hidden pt-[60px] pb-0">
          {/* Tech Grid Background with Radial Fade */}
          <div className="absolute inset-0" style={{
            background: `radial-gradient(ellipse at center, transparent 0%, #f8fafc 70%),
                        repeating-linear-gradient(to right, rgba(0, 0, 0, 0.03) 0px, rgba(0, 0, 0, 0.03) 1px, transparent 1px, transparent 40px),
                        repeating-linear-gradient(to bottom, rgba(0, 0, 0, 0.03) 0px, rgba(0, 0, 0, 0.03) 1px, transparent 1px, transparent 40px)`
          }}></div>

          <div className="max-w-7xl mx-auto px-4 relative z-10">
            <div className="text-center space-y-8 max-w-4xl mx-auto">
              <span className="font-mono text-xs uppercase tracking-wider text-slate-400 mb-4 block">Industry Solutions</span>

              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900">
                Tailored for <span className="font-serif italic text-[#2A9D90]">Your</span> Industry
              </h1>

              <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
                From manufacturers managing thousands of SKUs to agencies handling multiple client brands, Doculoom adapts to your workflow.
              </p>

              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
                <Button
                  size="lg"
                  onClick={handleFreeSignup}
                  className="h-14 px-8 text-lg bg-[#2A9D90] hover:bg-[#2A9D90]/90 text-white shadow-xl shadow-[#2A9D90]/20 hover:shadow-2xl transition-all border-0"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => setLocation("/demo")}
                  className="h-14 px-8 text-lg border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                >
                  Book a Demo
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Main Solutions Grid */}
        <section className="py-0">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid lg:grid-cols-3 gap-8">

              {/* Manufacturers Card */}
              <SolutionCard
                icon={<Factory className="text-[#2A9D90]" size={24} />}
                title="For Manufacturers"
                description="Transform your product database into professional spec sheets automatically."
                features={[
                  'Batch generate from ERP exports',
                  'Automatic image matching by SKU',
                  'Technical specification tables',
                  'Multi-language support',
                  'Compliance documentation'
                ]}
                useCases={['Product catalogs', 'Technical data sheets', 'Safety documentation']}
                refCode="MFG-001"
              />

              {/* Agencies Card */}
              <SolutionCard
                icon={<Briefcase className="text-[#2A9D90]" size={24} />}
                title="For Agencies"
                highlighted
                description="Design once, generate for every client. Scale your production without scaling your team."
                features={[
                  'White-label templates',
                  'Client brand management',
                  'Bulk campaign materials',
                  'Version control & history',
                  'Team collaboration'
                ]}
                useCases={['Client deliverables', 'Campaign collateral', 'Branded materials']}
                refCode="AGY-001"
              />

              {/* Enterprises Card */}
              <SolutionCard
                icon={<Building2 className="text-[#2A9D90]" size={24} />}
                title="For Enterprises"
                description="Streamline document generation across your entire organization with enterprise-grade features."
                features={[
                  'SSO & advanced security',
                  'Department-level permissions',
                  'API integration',
                  'Dedicated rendering servers',
                  'Custom SLA support'
                ]}
                useCases={['Internal communications', 'Sales enablement', 'Operations docs']}
                refCode="ENT-001"
              />

            </div>
          </div>
        </section>

        {/* Industry Use Cases */}
        <section className="py-0">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <span className="font-mono text-xs uppercase tracking-wider text-slate-400 mb-4 block">Use Cases</span>
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 mb-4">Built for Every Industry</h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                See how teams across industries use Doculoom to automate their document workflows.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <IndustryCard
                icon={<ShoppingBag className="text-[#2A9D90]" size={20} />}
                title="Retail & Wholesale"
                description="Generate shelf tags, price lists, and product catalogs from your inventory system."
              />
              <IndustryCard
                icon={<Stethoscope className="text-[#2A9D90]" size={20} />}
                title="Healthcare"
                description="Create compliant medical device documentation and patient information sheets."
              />
              <IndustryCard
                icon={<Utensils className="text-[#2A9D90]" size={20} />}
                title="Food & Beverage"
                description="Produce nutrition labels, ingredient lists, and menu boards at scale."
              />
              <IndustryCard
                icon={<Users className="text-[#2A9D90]" size={20} />}
                title="Events & Conferences"
                description="Print personalized badges, schedules, and certificates for every attendee."
              />
            </div>
          </div>
        </section>

        {/* Workflow Integration Section */}
        <section className="py-0">
          <div className="max-w-7xl mx-auto px-4">
            <div className="bg-slate-900 rounded-3xl p-8 lg:p-16 relative overflow-hidden">
              {/* Grid overlay */}
              <div className="absolute inset-0 opacity-20" style={{
                backgroundSize: '20px 20px',
                backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)'
              }}></div>

              <div className="grid lg:grid-cols-2 gap-12 items-center relative z-10">
                <div>
                  <span className="font-mono text-xs uppercase tracking-wider text-slate-400 mb-4 block">Integration</span>
                  <h2 className="text-3xl lg:text-4xl font-bold tracking-tight text-white mb-6">
                    Fits Into Your <span className="font-serif italic text-[#2A9D90]">Existing</span> Workflow
                  </h2>
                  <p className="text-lg text-slate-300 leading-relaxed mb-8">
                    Doculoom works with the tools you already use. Export from your ERP, PIM, or database and generate professional documents without changing your process.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <IntegrationFeature icon={<FileSpreadsheet size={18} />} text="Excel & CSV Import" />
                    <IntegrationFeature icon={<Database size={18} />} text="Database Export Compatible" />
                    <IntegrationFeature icon={<LayoutTemplate size={18} />} text="Template Library" />
                    <IntegrationFeature icon={<Zap size={18} />} text="API Access (Scale)" />
                  </div>
                </div>

                {/* Visual */}
                <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
                  <div className="flex items-center gap-2 mb-4 pb-4 border-b border-slate-700">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="ml-2 font-mono text-xs text-slate-500">workflow.integration</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded border border-slate-600">
                      <FileSpreadsheet className="text-green-500" size={20} />
                      <span className="font-mono text-sm text-slate-300">products.xlsx</span>
                      <ArrowRight className="text-slate-500 ml-auto" size={16} />
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-[#2A9D90]/20 rounded border border-[#2A9D90]/40">
                      <LayoutTemplate className="text-[#2A9D90]" size={20} />
                      <span className="font-mono text-sm text-[#2A9D90]">Doculoom Processing...</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-slate-700/50 rounded border border-slate-600">
                      <Printer className="text-slate-400" size={20} />
                      <span className="font-mono text-sm text-slate-300">catalog_2024.pdf</span>
                      <span className="ml-auto font-mono text-xs text-green-400">READY</span>
                    </div>
                  </div>
                  {/* Corner Mark */}
                  <div className="text-slate-600 font-mono text-xs mt-4 text-right">&#x231F;</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-0 bg-white">
          <div className="max-w-5xl mx-auto px-4 py-20">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <StatCard value="10,000+" label="Documents Generated" subtext="Monthly average" />
              <StatCard value="90%" label="Time Saved" subtext="vs. manual design" />
              <StatCard value="300 DPI" label="Export Quality" subtext="Print-ready output" />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 bg-white border-y border-slate-100">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-4xl font-bold tracking-tight text-slate-900 mb-6">
              Ready to transform your document workflow?
            </h2>
            <p className="text-xl text-slate-600 mb-8">
              Join teams who've automated their catalog and spec sheet production.
            </p>
            <div className="flex justify-center gap-4">
              <Button
                size="lg"
                onClick={handleFreeSignup}
                className="h-14 px-8 text-lg bg-[#2A9D90] hover:bg-[#2A9D90]/90 text-white shadow-lg"
              >
                Get Started Free
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setLocation("/demo")}
                className="h-14 px-8 text-lg border-slate-200 hover:bg-slate-50"
              >
                Schedule Demo
              </Button>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}

// Solution Card Component
function SolutionCard({
  icon,
  title,
  description,
  features,
  useCases,
  refCode,
  highlighted = false
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  features: string[];
  useCases: string[];
  refCode: string;
  highlighted?: boolean;
}) {
  return (
    <div className={`p-8 rounded-xl bg-white flex flex-col h-full relative ${
      highlighted
        ? 'border-t-4 border-t-[#2A9D90] border-x border-b border-slate-200 shadow-xl scale-105 z-10'
        : 'border-t-4 border-t-slate-900 border-x border-b border-slate-200 hover:shadow-lg transition-shadow'
    }`}>
      {highlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2A9D90] text-white px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider">
          Most Popular
        </div>
      )}

      <div className="mb-6">
        <div className="w-12 h-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
          {icon}
        </div>
        <h3 className="text-2xl font-bold tracking-tight text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-600 leading-relaxed">{description}</p>
      </div>

      <div className="space-y-3 mb-6 flex-1">
        <span className="font-mono text-xs uppercase tracking-wider text-slate-400 block">Key Features</span>
        {features.map((feature, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-[#2A9D90]/10 flex items-center justify-center flex-shrink-0">
              <CheckCircle2 className="h-3 w-3 text-[#2A9D90]" />
            </div>
            <span className="text-slate-600 text-sm">{feature}</span>
          </div>
        ))}
      </div>

      <div className="pt-4 border-t border-slate-100">
        <span className="font-mono text-xs uppercase tracking-wider text-slate-400 block mb-2">Common Use Cases</span>
        <div className="flex flex-wrap gap-2">
          {useCases.map((useCase, i) => (
            <span key={i} className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded font-medium">
              {useCase}
            </span>
          ))}
        </div>
      </div>

      {/* Technical Footer */}
      <div className="tech-footer">
        <span>REF: {refCode}</span>
        <span>&#x231F;</span>
      </div>
    </div>
  );
}

// Industry Card Component
function IndustryCard({
  icon,
  title,
  description
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl border border-slate-200 bg-white hover:shadow-lg transition-shadow relative">
      <div className="mb-4 bg-slate-50 w-10 h-10 rounded-lg flex items-center justify-center border border-slate-100">
        {icon}
      </div>
      <h3 className="font-bold tracking-tight text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
      {/* Corner Mark */}
      <div className="absolute bottom-3 right-3 text-slate-300 font-mono text-sm">&#x231F;</div>
    </div>
  );
}

// Stat Card Component
function StatCard({ value, label, subtext }: { value: string; label: string; subtext: string }) {
  return (
    <div className="space-y-2">
      <div className="text-5xl font-bold font-mono text-[#2A9D90]">{value}</div>
      <div className="text-xl font-bold text-slate-900">{label}</div>
      <div className="text-sm text-slate-500 font-mono uppercase tracking-wider">{subtext}</div>
    </div>
  );
}

// Integration Feature Component
function IntegrationFeature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg border border-slate-700">
      <div className="text-[#2A9D90]">{icon}</div>
      <span className="text-sm text-slate-300">{text}</span>
    </div>
  );
}

import { PublicHeader } from "@/components/layout/PublicHeader";
import { Footer } from "@/components/layout/Footer"; // <--- Imported Footer
import { Helmet } from "react-helmet-async"; 

export default function Solutions() {
  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>Solutions - For Agencies & Manufacturers | Doculoom</title>
        <meta name="description" content="Streamline document generation for retail, manufacturing, and agencies. Create data-driven spec sheets at scale." />
        <link rel="canonical" href="https://doculoom.io/solutions" />
      </Helmet>

      <PublicHeader />

      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h1 className="text-3xl md:text-4xl font-bold">Solutions</h1>
            <p className="text-lg text-muted-foreground">Learn how Doculoom solves your design challenges</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-12">
            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold text-lg mb-3">For Manufacturers</h3>
              <p className="text-muted-foreground">Create product spec sheets automatically from your inventory data.</p>
            </div>
            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold text-lg mb-3">For Agencies</h3>
              <p className="text-muted-foreground">Design templates once, generate hundreds of client documents instantly.</p>
            </div>
            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold text-lg mb-3">For Enterprises</h3>
              <p className="text-muted-foreground">Streamline document generation across your entire organization.</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
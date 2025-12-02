import { PublicHeader } from "@/components/layout/PublicHeader";

export default function Features() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Features</h2>
            <p className="text-lg text-muted-foreground">Everything you need to create professional spec sheets</p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 mt-12">
            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold text-lg mb-3">Design Canvas</h3>
              <p className="text-muted-foreground">Intuitive drag-and-drop interface for creating custom layouts.</p>
            </div>
            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold text-lg mb-3">Excel Integration</h3>
              <p className="text-muted-foreground">Upload your data and automatically map it to your designs.</p>
            </div>
            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold text-lg mb-3">PDF Export</h3>
              <p className="text-muted-foreground">Export single or batch PDF documents in multiple formats.</p>
            </div>
            <div className="p-6 border rounded-lg">
              <h3 className="font-semibold text-lg mb-3">Design Templates</h3>
              <p className="text-muted-foreground">Save and reuse your designs across multiple projects.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

import { PublicHeader } from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/button";
import { SignUpButton } from "@clerk/clerk-react";

export default function Homepage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="text-center space-y-6">
          <h2 className="text-4xl md:text-5xl font-bold">Create Professional Spec Sheets</h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Combine custom designs with Excel data to generate stunning spec sheets in minutes. No design experience required.
          </p>
          <div className="flex justify-center gap-4 pt-4">
            <SignUpButton mode="modal">
              <Button size="lg" data-testid="btn-cta-signup">
                Get Started Free
              </Button>
            </SignUpButton>
            <Button variant="outline" size="lg" data-testid="btn-learn-more">
              Learn More
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

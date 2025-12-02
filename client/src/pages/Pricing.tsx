import { PublicHeader } from "@/components/layout/PublicHeader";
import { Button } from "@/components/ui/button";

export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      <section className="max-w-7xl mx-auto px-4 py-20">
        <div className="space-y-8">
          <div className="text-center space-y-4">
            <h2 className="text-3xl md:text-4xl font-bold">Simple, Transparent Pricing</h2>
            <p className="text-lg text-muted-foreground">Choose the plan that fits your needs</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-12">
            {/* Starter Plan */}
            <div className="p-8 border rounded-lg">
              <h3 className="font-semibold text-xl mb-2">Starter</h3>
              <p className="text-muted-foreground mb-6">For getting started</p>
              <div className="mb-6">
                <span className="text-3xl font-bold">Free</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="text-muted-foreground">• 5 designs</li>
                <li className="text-muted-foreground">• Basic export</li>
                <li className="text-muted-foreground">• Community support</li>
              </ul>
              <a href="/registration">
                <Button variant="outline" className="w-full" data-testid="btn-pricing-starter">
                  Get Started
                </Button>
              </a>
            </div>

            {/* Professional Plan */}
            <div className="p-8 border rounded-lg border-primary">
              <h3 className="font-semibold text-xl mb-2">Professional</h3>
              <p className="text-muted-foreground mb-6">Most popular</p>
              <div className="mb-6">
                <span className="text-3xl font-bold">$29</span>
                <span className="text-muted-foreground">/month</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="text-muted-foreground">• Unlimited designs</li>
                <li className="text-muted-foreground">• Batch export</li>
                <li className="text-muted-foreground">• Priority support</li>
              </ul>
              <a href="/registration">
                <Button className="w-full" data-testid="btn-pricing-professional">
                  Get Started
                </Button>
              </a>
            </div>

            {/* Enterprise Plan */}
            <div className="p-8 border rounded-lg">
              <h3 className="font-semibold text-xl mb-2">Enterprise</h3>
              <p className="text-muted-foreground mb-6">For large teams</p>
              <div className="mb-6">
                <span className="text-3xl font-bold">Custom</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="text-muted-foreground">• Custom features</li>
                <li className="text-muted-foreground">• Dedicated support</li>
                <li className="text-muted-foreground">• SSO & advanced security</li>
              </ul>
              <Button variant="outline" className="w-full" data-testid="btn-pricing-enterprise">
                Contact Sales
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

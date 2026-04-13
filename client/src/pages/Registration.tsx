import { SignUp } from "@clerk/clerk-react";
import { Helmet } from "react-helmet-async";
import { useEffect } from "react";
import { BRAND } from "@/config/brand";

export default function Registration() {
  const plan = sessionStorage.getItem("checkoutPlan");
  const priceId = sessionStorage.getItem("checkoutPriceId");

  useEffect(() => {
    if (plan && priceId) {
      sessionStorage.setItem("pendingCheckout", JSON.stringify({ plan, priceId }));
    }
  }, []);

  const afterSignUpUrl = "/checkout";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <Helmet>
        <title>Create Account | Doculoom</title>
        <meta name="description" content="Sign up for Doculoom to start creating professional spec sheets and product catalogs from your data." />
      </Helmet>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img
            src={BRAND.logoUrl}
            alt={BRAND.name}
            className="h-10 mx-auto mb-4"
          />
          <p className="text-muted-foreground mt-2">Create your account</p>
        </div>
        <SignUp
          routing="hash"
          signInUrl="/login"
          fallbackRedirectUrl={afterSignUpUrl}
          appearance={{
            elements: {
              rootBox: "mx-auto",
              card: "shadow-none",
            },
          }}
        />
      </div>
    </div>
  );
}

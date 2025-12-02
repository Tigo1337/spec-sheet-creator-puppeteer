import { SignUp } from "@clerk/clerk-react";
import { useEffect } from "react";

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
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">SpecSheet Builder</h1>
          <p className="text-muted-foreground mt-2">Create your account</p>
        </div>
        <SignUp
          routing="hash"
          signInUrl="/login"
          afterSignUpUrl={afterSignUpUrl}
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

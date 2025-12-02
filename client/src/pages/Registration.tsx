import { SignUp } from "@clerk/clerk-react";
import { useEffect, useState } from "react";

export default function Registration() {
  const [afterSignUpUrl, setAfterSignUpUrl] = useState("/editor");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const priceId = urlParams.get("priceId");
    const plan = urlParams.get("plan");

    if (priceId && plan) {
      setAfterSignUpUrl(`/checkout?plan=${plan}&priceId=${priceId}`);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">SpecSheet Builder</h1>
          <p className="text-muted-foreground mt-2">Create your account</p>
        </div>
        <SignUp
          routing="path"
          path="/registration"
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

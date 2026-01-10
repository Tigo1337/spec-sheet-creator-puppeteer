import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button"; // Using your existing UI components
import { Link } from "wouter";

export default function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('doculoom_cookie_consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleConsent = (accepted: boolean) => {
    localStorage.setItem('doculoom_cookie_consent', accepted ? 'accepted' : 'declined');
    setIsVisible(false);
    // Reload to trigger conditional script loading in main.tsx
    window.location.reload();
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 bg-white border-t border-slate-200 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex-1 text-center md:text-left">
          <h4 className="text-sm font-bold text-slate-900 mb-1">
            Privacy Preferences / Vos préférences de confidentialité
          </h4>
          <p className="text-xs text-slate-600 leading-relaxed">
            We use cookies to improve your experience. Non-essential trackers (like Sentry or Analytics) are disabled by default. 
            <br />
            Nous utilisons des témoins pour améliorer votre expérience. Les traceurs non essentiels sont désactivés par défaut.
            <Link href="/privacy" className="underline ml-1 text-primary hover:text-primary/80">
              Learn more / En savoir plus
            </Link>
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <Button
            variant="outline"
            onClick={() => handleConsent(false)}
            className="flex-1 sm:flex-none border-slate-300 text-slate-700 h-9 text-xs"
          >
            Refuse All / Refuser tout
          </Button>
          <Button
            onClick={() => handleConsent(true)}
            className="flex-1 sm:flex-none bg-[#2A9D90] hover:bg-[#238277] text-white h-9 text-xs"
          >
            Accept All / Accepter tout
          </Button>
        </div>
      </div>
    </div>
  );
}
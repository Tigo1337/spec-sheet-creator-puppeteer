import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/clerk-react"; // Import useUser

export function PublicHeader() {
  const [location] = useLocation();
  const { isSignedIn } = useUser(); // Check auth state

  const navItems = [
    { label: "Solutions", href: "/solutions" },
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Book Demo", href: "/demo" },
  ];

  return (
    <header className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* ... Logo ... */}
        <a href="/" className="flex items-center gap-2">
          <img 
            src="https://res.cloudinary.com/olilepage/image/upload/t_transparent_background/v1765033347/doculoom-io-wordmark-logo-cropped_iwkw3v.png" 
            alt="Doculoom" 
            className="h-8"
          />
        </a>

        {/* ... Navigation Menu ... */}
        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`text-sm transition-colors ${
                location === item.href
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Dynamic Auth Buttons */}
        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <a href="/editor">
              <Button size="sm" className="font-semibold">
                Go to App
              </Button>
            </a>
          ) : (
            <>
              <a href="/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </a>
              <a href="/registration">
                <Button size="sm">Sign Up</Button>
              </a>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
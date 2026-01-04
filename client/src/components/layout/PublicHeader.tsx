import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useUser } from "@clerk/clerk-react"; // Import useUser

export function PublicHeader() {
  const [location] = useLocation();
  const { isSignedIn } = useUser();

  const navItems = [
    { label: "Solutions", href: "/solutions" },
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
    { label: "Book Demo", href: "/demo" },
  ];

  return (
    // Added: sticky, top-0, z-50, and w-full
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* ... rest of your code remains the same ... */}
        <a href="/" className="flex items-center gap-2">
          <img 
            src="https://res.cloudinary.com/olilepage/image/upload/t_transparent_background/v1767054291/doculoom/logos/doculoom-io-wordmark-logo-cropped.png" 
            alt="Doculoom" 
            className="h-8"
          />
        </a>

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
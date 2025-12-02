import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  const [location] = useLocation();

  const navItems = [
    { label: "Solutions", href: "/solutions" },
    { label: "Features", href: "/features" },
    { label: "Pricing", href: "/pricing" },
  ];

  return (
    <header className="border-b bg-background">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2">
          <h1 className="text-xl font-bold">SpecSheet Builder</h1>
        </a>

        {/* Navigation Menu */}
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
              data-testid={`nav-link-${item.label.toLowerCase()}`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Auth Buttons */}
        <div className="flex items-center gap-3">
          <a href="/login">
            <Button variant="ghost" size="sm" data-testid="btn-sign-in">
              Sign In
            </Button>
          </a>
          <a href="/registration">
            <Button size="sm" data-testid="btn-sign-up">
              Sign Up
            </Button>
          </a>
        </div>
      </div>
    </header>
  );
}

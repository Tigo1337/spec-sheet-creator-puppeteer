import { Link } from "wouter";
import { BRAND } from "@/config/brand";

export function Footer() {
  const linkClass = "hover:text-[#2A9D90] transition-colors";

  return (
    <footer className="bg-white border-t border-slate-200 py-12 font-sans">
      <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-8 text-center md:text-left">

        <div className="flex flex-col items-center md:items-start gap-3">
          <Link href="/">
            <img
              src={BRAND.iconUrl}
              alt={BRAND.name}
              className="h-10 w-auto"
              onError={(e) => {
                const target = e.currentTarget;
                target.onerror = null;
                target.src = BRAND.logoUrl;
              }}
            />
          </Link>
          <p className="text-xs text-slate-400 max-w-[180px] leading-relaxed">
            Data-driven documents for modern teams.
          </p>
        </div>

        <div>
          <h4 className="font-bold mb-4 text-slate-900">Product</h4>
          <ul className="space-y-2 text-sm text-slate-500">
            <li><Link href="/features" className={linkClass}>Features</Link></li>
            <li><Link href="/pricing" className={linkClass}>Pricing</Link></li>
            <li><Link href="/login" className={linkClass}>Login</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-4 text-slate-900">Support</h4>
          <ul className="space-y-2 text-sm text-slate-500">
            <li><a href="mailto:support@doculoom.io" className={linkClass}>Help Center</a></li>
            <li><a href="mailto:sales@doculoom.io" className={linkClass}>Contact Sales</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-4 text-slate-900">Legal</h4>
          <ul className="space-y-2 text-sm text-slate-500">
            <li><Link href="/privacy" className={linkClass}>Privacy Policy</Link></li>
            <li><Link href="/terms" className={linkClass}>Terms of Service</Link></li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-slate-100 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
      </div>
    </footer>
  );
}

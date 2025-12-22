import { Layers } from "lucide-react";
import { Link } from "wouter";

export function Footer() {
  const accentColor = "text-[#2A9D90]";

  return (
    <footer className="bg-white border-t border-slate-200 py-12 font-sans">
      <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-4 gap-8">
        <div>
          <Link href="/">
            <a className="flex items-center gap-2 font-bold text-xl text-slate-900 mb-4 cursor-pointer">
              <div className="w-8 h-8 bg-[#2A9D90] rounded-lg flex items-center justify-center text-white">
                <Layers size={20} />
              </div>
              Doculoom
            </a>
          </Link>
          <p className="text-slate-500 text-sm">
            Automating document creation for modern teams.
          </p>
        </div>

        <div>
          <h4 className="font-bold mb-4 text-slate-900">Product</h4>
          <ul className="space-y-2 text-sm text-slate-500">
            <li><Link href="/features"><a className={`hover:${accentColor}`}>Features</a></Link></li>
            <li><Link href="/pricing"><a className={`hover:${accentColor}`}>Pricing</a></Link></li>
            <li><Link href="/login"><a className={`hover:${accentColor}`}>Login</a></Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-4 text-slate-900">Support</h4>
          <ul className="space-y-2 text-sm text-slate-500">
            <li><a href="mailto:support@doculoom.io" className={`hover:${accentColor}`}>Help Center</a></li>
            <li><a href="mailto:sales@doculoom.io" className={`hover:${accentColor}`}>Contact Sales</a></li>
          </ul>
        </div>

        <div>
          <h4 className="font-bold mb-4 text-slate-900">Legal</h4>
          <ul className="space-y-2 text-sm text-slate-500">
            <li><Link href="/privacy"><a className={`hover:${accentColor}`}>Privacy Policy</a></Link></li>
            <li><Link href="/terms"><a className={`hover:${accentColor}`}>Terms of Service</a></Link></li>
          </ul>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 mt-12 pt-8 border-t border-slate-100 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} Doculoom. All rights reserved.
      </div>
    </footer>
  );
}
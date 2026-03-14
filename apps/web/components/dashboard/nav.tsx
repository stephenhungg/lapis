"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";

const navLinks = [
  { name: "Features", href: "/#features" },
  { name: "How it works", href: "/#how-it-works" },
  { name: "Developers", href: "/#developers" },
];

const APP_TABS = [
  { label: "Markets", href: "/dashboard" },
  { label: "List startup", href: "/list" },
  { label: "Portfolio", href: "/portfolio" },
  { label: "Equity", href: "/equity" },
];

export function DashboardNav() {
  const pathname = usePathname();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed z-50 transition-all duration-500 ${
        isScrolled ? "top-4 left-4 right-4" : "top-0 left-0 right-0"
      }`}
    >
      <div
        className={`mx-auto transition-all duration-500 ${
          isScrolled || isMobileMenuOpen
            ? "bg-background/80 backdrop-blur-xl border border-foreground/10 rounded-2xl shadow-lg max-w-[1200px]"
            : "bg-background/95 backdrop-blur-sm max-w-[1400px]"
        }`}
      >
        {/* Top row — identical to landing nav */}
        <div
          className={`flex items-center justify-between transition-all duration-500 px-6 lg:px-8 ${
            isScrolled ? "h-14" : "h-20"
          }`}
        >
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <span className={`font-display tracking-tight transition-all duration-500 ${isScrolled ? "text-xl" : "text-2xl"}`}>Lapis</span>
            <span className={`text-muted-foreground font-mono transition-all duration-500 ${isScrolled ? "text-[10px] mt-0.5" : "text-xs mt-1"}`}>TM</span>
          </Link>

          <div className="hidden md:flex items-center gap-12">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                href={link.href}
                className="text-sm text-foreground/70 hover:text-foreground transition-colors duration-300 relative group"
              >
                {link.name}
                <span className="absolute -bottom-1 left-0 w-0 h-px bg-foreground transition-all duration-300 group-hover:w-full" />
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-6">
            <a
              href="https://github.com/stephenhungg/babhacks"
              target="_blank"
              rel="noopener noreferrer"
              className={`text-foreground/70 hover:text-foreground transition-all duration-300 relative group ${isScrolled ? "text-xs" : "text-sm"}`}
            >
              GitHub
              <span className="absolute -bottom-1 left-0 w-0 h-px bg-foreground transition-all duration-300 group-hover:w-full" />
            </a>
          </div>

          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden p-2"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* App tabs sub-row */}
        <div className={`hidden md:flex items-center gap-8 px-6 lg:px-8 border-t border-foreground/10 transition-all duration-500 ${isScrolled ? "h-9" : "h-10"}`}>
          {APP_TABS.map((tab) => {
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`text-xs transition-colors duration-300 relative group h-full flex items-center ${
                  active ? "text-foreground font-medium" : "text-foreground/50 hover:text-foreground"
                }`}
              >
                {tab.label}
                <span className={`absolute bottom-0 left-0 h-px bg-foreground transition-all duration-300 ${active ? "w-full" : "w-0 group-hover:w-full"}`} />
              </Link>
            );
          })}
        </div>
      </div>
    </header>
  );
}

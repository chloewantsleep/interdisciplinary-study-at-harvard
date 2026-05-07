"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Search, Network, Sparkles } from "lucide-react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";

const items = [
  { href: "/",        label: "Dashboard",       icon: LayoutDashboard },
  { href: "/explore", label: "Explore",          icon: Search },
  { href: "/graph",   label: "Knowledge Graph",  icon: Network },
  { href: "/suggest", label: "AI Advisor",        icon: Sparkles },
];

export default function Nav() {
  const path = usePathname();
  const { isLoaded, isSignedIn } = useUser();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center h-14 gap-6">
          {/* Wordmark */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <div className="w-7 h-7 rounded flex items-center justify-center text-white text-xs font-black" style={{ background: "#A51C30" }}>
              H
            </div>
            <span className="text-sm font-semibold text-gray-900">my.harvard</span>
            <span className="hidden sm:block text-xs text-gray-400 border border-gray-200 rounded px-1.5 py-0.5">Cross-Registration</span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1 ml-2">
            {items.map(({ href, label, icon: Icon }) => {
              const active = href === "/" ? path === "/" : path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    active
                      ? "bg-red-50 text-red-700 font-medium"
                      : "text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden sm:block">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Auth */}
          <div className="ml-auto flex items-center gap-3">
            {isLoaded && (
              isSignedIn ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 hidden sm:block">Courses synced</span>
                  <UserButton />
                </div>
              ) : (
                <SignInButton mode="modal">
                  <button className="text-sm font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                    Sign in
                  </button>
                </SignInButton>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

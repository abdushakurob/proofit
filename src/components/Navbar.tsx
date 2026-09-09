"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ExternalLink, User, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Navbar() {
  const pathname = usePathname();
  const { officer, isUnlocked, lock } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#e4e4e7]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Brand Logo & Main Nav Tabs */}
        <div className="flex items-center gap-8">
          <Link
            href="/"
            className="flex items-center gap-2 text-black tracking-tight font-semibold text-base focus:outline-none group"
          >
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-black text-white shadow-xs group-hover:bg-neutral-800 transition-colors">
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4.5 12.75l6 6 9-13.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="font-bold text-lg tracking-tight text-black">ProofIt</span>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
            <Link
              href="/workspace"
              className={`px-3 py-2 rounded-lg transition-all ${
                pathname === "/workspace"
                  ? "bg-neutral-100 text-black font-bold"
                  : "text-neutral-600 hover:text-black hover:bg-neutral-50"
              }`}
            >
              Evidence Desk
            </Link>

            <Link
              href="/verify"
              className={`px-3 py-2 rounded-lg transition-all ${
                pathname === "/verify"
                  ? "bg-neutral-100 text-black font-bold"
                  : "text-neutral-600 hover:text-black hover:bg-neutral-50"
              }`}
            >
              Proof Verification
            </Link>
          </nav>
        </div>

        {/* Right Header Actions */}
        <div className="flex items-center gap-3 text-xs">
          {/* OIN Identity Portal External Link */}
          <Link
            href="/oin"
            className="hidden sm:flex px-3.5 py-1.5 rounded-lg font-medium text-neutral-700 hover:text-black border border-neutral-300 bg-white hover:bg-neutral-50 transition-colors items-center gap-1.5"
            title="Open Officer Identification Network Portal"
          >
            <span>OIN Portal</span>
            <ExternalLink className="w-3 h-3 text-neutral-400" />
          </Link>

          {/* Officer Profile Badge or Sign In CTA */}
          {isUnlocked && officer ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-lg text-xs font-semibold text-black">
                <User className="w-3.5 h-3.5 text-neutral-600" />
                <span>{officer.fullName}</span>
              </div>
              <button
                onClick={lock}
                className="p-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-600 hover:text-black transition-colors"
                title="Sign out of desk"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link
              href="/login?redirect=workspace"
              className="inline-flex items-center justify-center px-4 py-2 rounded-xl font-bold text-white bg-black hover:bg-neutral-800 transition-all shadow-sm text-xs tracking-tight"
            >
              Officer Sign In
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

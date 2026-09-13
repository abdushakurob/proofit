"use client";

import React from "react";
import Navbar from "@/components/Navbar";
import CourtReview from "@/components/CourtReview";

export default function VerifyPage() {
  return (
    <div className="min-h-screen bg-[#f9f9fa] text-[#1a1c1d] flex flex-col font-sans selection:bg-black selection:text-white">
      <Navbar />
      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6">
        <CourtReview />
      </div>
      <footer className="border-t border-[#e4e4e7] bg-white py-6 text-center text-xs text-neutral-500">
        ProofIt Digital Evidence Preservation System • Zero-Trust Air-Gapped Architecture
      </footer>
    </div>
  );
}

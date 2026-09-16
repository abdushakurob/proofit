"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck, UserPlus, Users, Key, RefreshCw, CheckCircle2,
  Lock, Building2, User, Search, AlertCircle, Copy, Trash2,
  LogOut, ArrowRight, ExternalLink, Shield, History, Laptop,
  Files, Award, Network, FolderArchive, Gavel, FileCheck, Check
} from "lucide-react";

export interface OinOfficer {
  oin: string;
  full_name: string;
  rank: string;
  agency: string;
  public_stamp: string;
  status: string;
}

export default function OinPortalPage() {
  const [viewMode, setViewMode] = useState<"landing" | "login" | "dashboard">("landing");
  const [adminId, setAdminId] = useState<string>("");
  const [adminPassword, setAdminPassword] = useState<string>("");
  const [loginError, setLoginError] = useState<string>("");

  const [officers, setOfficers] = useState<OinOfficer[]>([]);
  const [search, setSearch] = useState<string>("");
  const [publicSearch, setPublicSearch] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"directory" | "enroll" | "apikeys">("directory");

  // Form State for New Officer Enrollment
  const [oin, setOin] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [rank, setRank] = useState<string>("");
  const [agency, setAgency] = useState<string>("EFCC Cybercrime Division");
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [copiedStampOin, setCopiedStampOin] = useState<string | null>(null);

  const API_KEY = "oin_live_sec_8f93e2b17a04c5d9e1823f4b6790a12c4e56";
  const SEEDED_ADMIN_ID = "OIN-ADMIN-001";
  const SEEDED_ADMIN_PASS = "oin_admin_2026";

  // Check initial admin session from localStorage or fetch initial roster
  useEffect(() => {
    const savedSession = localStorage.getItem("proofit_oin_admin_session");
    if (savedSession === "active") {
      setViewMode("dashboard");
    }
    fetchOfficers();
  }, []);

  const fetchOfficers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/officers");
      const data = await res.json();
      if (data.success && Array.isArray(data.officers)) {
        setOfficers(data.officers);
      }
    } catch (err) {
      console.error("Failed to fetch OIN roster:", err);
    }
    setIsLoading(false);
  };

  // Admin Login Handler
  const handleAdminLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAdminId = adminId.trim().toUpperCase();
    
    if (cleanAdminId === SEEDED_ADMIN_ID && adminPassword === SEEDED_ADMIN_PASS) {
      setViewMode("dashboard");
      localStorage.setItem("proofit_oin_admin_session", "active");
      setLoginError("");
      fetchOfficers();
    } else {
      setLoginError("Invalid Admin ID or Password. Use the seeded admin credentials below.");
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem("proofit_oin_admin_session");
    setViewMode("landing");
    setAdminId("");
    setAdminPassword("");
  };

  const fillSeededAdminCredentials = () => {
    setAdminId(SEEDED_ADMIN_ID);
    setAdminPassword(SEEDED_ADMIN_PASS);
    setLoginError("");
  };

  // Enroll Officer Handler
  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oin || !fullName || !agency) return;

    setIsSubmitting(true);
    setStatusMsg("");

    try {
      const res = await fetch("/api/officers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${API_KEY}`,
        },
        body: JSON.stringify({
          oin: oin.trim().toUpperCase(),
          full_name: fullName.trim(),
          rank: rank.trim() || "Investigating Officer",
          agency,
          public_stamp: "",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setStatusMsg(`Officer ${fullName} (${oin}) successfully enrolled into OIN Directory.`);
        setOin("");
        setFullName("");
        setRank("");
        fetchOfficers();
        setTimeout(() => setActiveTab("directory"), 1200);
      } else {
        setStatusMsg(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatusMsg("Failed to enroll officer identity.");
    }
    setIsSubmitting(false);
  };

  // Delete Officer Handler
  const handleDeleteOfficer = async (targetOin: string, name: string) => {
    if (!confirm(`Are you sure you want to de-enroll officer ${name} (${targetOin}) from the OIN database?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/officers?oin=${encodeURIComponent(targetOin)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        fetchOfficers();
      } else {
        alert(`Failed to delete officer: ${data.error}`);
      }
    } catch (err) {
      alert("Failed to delete officer identity.");
    }
  };

  const copyApiKey = () => {
    navigator.clipboard.writeText(API_KEY);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const copyPublicStamp = (stamp: string, oinId: string) => {
    navigator.clipboard.writeText(stamp);
    setCopiedStampOin(oinId);
    setTimeout(() => setCopiedStampOin(null), 2000);
  };

  const filtered = officers.filter(
    (o) =>
      o.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      o.oin?.toLowerCase().includes(search.toLowerCase()) ||
      o.agency?.toLowerCase().includes(search.toLowerCase()) ||
      o.public_stamp?.toLowerCase().includes(search.toLowerCase())
  );

  const publicFiltered = officers.filter(
    (o) =>
      !publicSearch.trim() ||
      o.full_name?.toLowerCase().includes(publicSearch.toLowerCase().trim()) ||
      o.oin?.toLowerCase().includes(publicSearch.toLowerCase().trim()) ||
      o.agency?.toLowerCase().includes(publicSearch.toLowerCase().trim()) ||
      o.public_stamp?.toLowerCase().includes(publicSearch.toLowerCase().trim())
  );

  const uniqueAgenciesCount = new Set(officers.map((o) => o.agency)).size;

  /* ─────────────────────────────────────────────────────────────
     VIEW 1: PUBLIC OIN LANDING PAGE
     ───────────────────────────────────────────────────────────── */
  if (viewMode === "landing") {
    return (
      <div className="bg-[#f9f9fa] text-[#1a1c1d] font-sans antialiased min-h-screen flex flex-col selection:bg-black selection:text-white">
        
        {/* ── STITCH CLEAN HEADER NAVIGATION ────────────────────────────────────── */}
        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#e4e4e7]">
          <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
            
            {/* Brand Logo & Main Nav Tabs */}
            <div className="flex items-center gap-8">
              <button
                onClick={() => setViewMode("landing")}
                className="flex items-center gap-2 text-black tracking-tight font-semibold text-base focus:outline-none group"
              >
                <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-black text-white shadow-xs group-hover:bg-neutral-800 transition-colors">
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                </span>
                <span className="font-bold text-lg tracking-tight text-black">ProofIt OIN</span>
              </button>

              {/* Navigation Links */}
              <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
                <Link
                  href="/workspace"
                  className="px-3 py-2 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-50 transition-all"
                >
                  Evidence Desk
                </Link>
                <Link
                  href="/verify"
                  className="px-3 py-2 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-50 transition-all"
                >
                  Proof Verification
                </Link>
                <Link
                  href="/docs"
                  className="px-3 py-2 rounded-lg text-neutral-600 hover:text-black hover:bg-neutral-50 transition-all"
                >
                  API Docs
                </Link>
              </nav>
            </div>

            {/* Right Header Actions */}
            <div className="flex items-center gap-3 text-xs">
              <Link
                href="/"
                className="hidden sm:flex px-3.5 py-1.5 rounded-lg font-medium text-neutral-700 hover:text-black border border-neutral-300 bg-white hover:bg-neutral-50 transition-colors items-center gap-1.5"
                title="Return to ProofIt Evidence Desk"
              >
                <span>ProofIt App</span>
                <ExternalLink className="w-3 h-3 text-neutral-400" />
              </Link>

              <button
                onClick={() => setViewMode("login")}
                className="inline-flex items-center justify-center px-4 py-2 rounded-xl font-bold text-white bg-black hover:bg-neutral-800 transition-all shadow-sm text-xs tracking-tight gap-1.5"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Admin Sign In</span>
              </button>
            </div>
          </div>
        </header>

        {/* ── STITCH HERO SECTION ────────────────────────────────────────── */}
        <section className="pt-16 pb-16 sm:pt-24 sm:pb-20 max-w-5xl mx-auto px-6 text-center flex-1">
          
          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-[-0.035em] text-black leading-[1.08] max-w-4xl mx-auto">
            Official Officer Identity & Stamp Verification Portal.
          </h1>
          <p className="mt-6 text-base sm:text-lg text-neutral-600 leading-relaxed max-w-2xl mx-auto font-normal tracking-[-0.01em]">
            The Officer Identification Network (OIN) provisions, verifies, and registers official officer badges and digital security stamps so evidence signatures can be verified and trusted.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3.5">
            <button
              onClick={() => setViewMode("login")}
              className="w-full sm:w-auto px-5 py-2.5 rounded-md text-sm font-medium text-white bg-black hover:bg-neutral-800 transition-colors shadow-sm inline-flex items-center justify-center gap-2"
            >
              <span>Sign in to Admin Portal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
            
            <a
              href="#public-lookup"
              className="w-full sm:w-auto px-5 py-2.5 rounded-md text-sm font-medium text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 transition-colors inline-flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              <span>Verify Badge or Stamp</span>
            </a>
          </div>

          {/* Context Certificate Preview (Editorial Ledger Slip for OIN) */}
          <div className="mt-16 max-w-2xl mx-auto text-left">
            <div className="rounded-xl border border-[#e4e4e7] bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)] p-6 sm:p-7">
              <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-5">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-neutral-900"></span>
                  <span className="text-xs font-semibold uppercase tracking-wider text-black">Official Officer Verification Card</span>
                </div>
                <span className="font-mono text-[11px] text-neutral-400 tracking-tight">REGISTRY REF: #OIN-2026-STAMP-001</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                <div className="sm:col-span-4 aspect-[4/3] rounded-md bg-neutral-50 border border-neutral-200 overflow-hidden flex flex-col justify-center items-center p-3 text-center">
                  <ShieldCheck className="text-neutral-700 w-8 h-8 mb-1 stroke-[1.75]" />
                  <span className="text-[11px] font-mono text-neutral-700 font-medium">OFFICER_STAMP</span>
                  <span className="text-[10px] font-mono text-neutral-400">Public Stamp Verified</span>
                </div>
                
                <div className="sm:col-span-8 space-y-2">
                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">Officer Status</div>
                    <div className="text-sm font-semibold text-black flex items-center gap-1.5 mt-0.5">
                      <Check className="w-4 h-4 text-black inline stroke-[3]" />
                      Active Officer Badge & Valid Security Stamp
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                    <div>
                      <span className="text-neutral-400 block text-[10px]">Officer Badge ID</span>
                      <span className="font-mono text-neutral-800 text-[11px]">EFCC-89421 (Senior Det.)</span>
                    </div>
                    <div>
                      <span className="text-neutral-400 block text-[10px]">Agency</span>
                      <span className="font-mono text-neutral-800 text-[11px]">EFCC Cybercrime Div.</span>
                    </div>
                  </div>
                  
                  <div className="pt-2 text-[11px] font-mono text-neutral-500 flex items-center justify-between border-t border-neutral-100">
                    <span>Public Key Stamp: 04a8b92c10...</span>
                    <span className="text-black font-medium">Verified Authentic</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── THE IDENTITY CHALLENGE SECTION ──────────────────────── */}
        <section className="py-20 bg-white border-t border-b border-[#e4e4e7]" id="challenge">
          <div className="max-w-4xl mx-auto px-6">
            <div className="max-w-2xl mb-10">
              <h2 className="text-3xl sm:text-4xl font-semibold text-black tracking-[-0.025em]">Why Central Identity Matters</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              <div className="md:col-span-8 space-y-5 text-neutral-600 leading-relaxed text-base sm:text-[17px]">
                <p>
                  When digital evidence is handed over between investigative units, confirming the identity of the officer who collected and sealed the files is critical.
                </p>
                <p>
                  Without a central directory of verified officer badges and security stamps, evidence handovers can be challenged over questioned signatures or unverified badge credentials. OIN guarantees that every signed record maps directly to an active, verified officer.
                </p>
              </div>
              
              <div className="md:col-span-4 p-5 rounded-lg border border-[#e4e4e7] bg-[#f9f9fa] space-y-4">
                <div className="text-xs font-mono text-neutral-400 uppercase tracking-wider">Key Security Risks Addressed</div>
                <div className="space-y-3 text-xs text-neutral-700">
                  <div className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 mt-1.5 flex-shrink-0"></span>
                    <span>Prevents unauthorized or fake officer signatures</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 mt-1.5 flex-shrink-0"></span>
                    <span>Validates badge numbers against central law enforcement records</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 mt-1.5 flex-shrink-0"></span>
                    <span>Eliminates disputes over officer key authenticity</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SYSTEM CAPABILITIES SECTION ────────────────────────────────── */}
        <section className="py-20 max-w-6xl mx-auto px-6" id="capabilities">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl sm:text-4xl font-semibold text-black tracking-[-0.025em]">Key Safeguards</h2>
            <p className="mt-3 text-neutral-600 text-sm sm:text-base leading-relaxed">
              Four core identity safeguards designed to protect evidence authenticity across agencies.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Safeguard 1 */}
            <div className="p-8 rounded-lg border border-[#e4e4e7] bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs text-neutral-400 tracking-wider">SAFEGUARD / 01</span>
                  <Lock className="text-neutral-700 w-5 h-5" />
                </div>
                <h3 className="text-xl font-semibold text-black tracking-tight mb-3">Central Officer Stamp Registry</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Stores official public security stamps centrally so evidence workstations can verify signatures without relying on unverified local settings.
                </p>
              </div>
            </div>

            {/* Safeguard 2 */}
            <div className="p-8 rounded-lg border border-[#e4e4e7] bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs text-neutral-400 tracking-wider">SAFEGUARD / 02</span>
                  <Building2 className="text-neutral-700 w-5 h-5" />
                </div>
                <h3 className="text-xl font-semibold text-black tracking-tight mb-3">Multi-Agency Federation</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Connects EFCC, Nigeria Police Force, ICPC, and State Security services so cross-agency evidence handovers remain seamless and verifiable.
                </p>
              </div>
            </div>

            {/* Safeguard 3 */}
            <div className="p-8 rounded-lg border border-[#e4e4e7] bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs text-neutral-400 tracking-wider">SAFEGUARD / 03</span>
                  <Key className="text-neutral-700 w-5 h-5" />
                </div>
                <h3 className="text-xl font-semibold text-black tracking-tight mb-3">Secure App Access Tokens</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Issues secure integration tokens for evidence intake desks and verifiers to check officer stamps in real time.
                </p>
              </div>
            </div>

            {/* Safeguard 4 */}
            <div className="p-8 rounded-lg border border-[#e4e4e7] bg-white flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-xs text-neutral-400 tracking-wider">SAFEGUARD / 04</span>
                  <History className="text-neutral-700 w-5 h-5" />
                </div>
                <h3 className="text-xl font-semibold text-black tracking-tight mb-3">Instant Revocation & Audit</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  Allows administrators to immediately revoke compromised badges while preserving a permanent audit history of past verified transfers.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── PUBLIC DIRECTORY LOOKUP SECTION ─────────────────────────────── */}
        <section className="py-20 max-w-5xl mx-auto px-6" id="public-lookup">
          <div className="rounded-xl border border-[#e4e4e7] bg-white p-8 sm:p-12 space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-neutral-100 pb-4">
              <div>
                <h2 className="text-2xl font-bold text-black flex items-center gap-2">
                  <Users className="w-5 h-5 text-black" />
                  <span>Officer Badge & Public Stamp Verification</span>
                </h2>
                <p className="text-xs text-neutral-500 mt-1">
                  Enter an Officer ID or paste a copied Public Stamp hash to verify active identity status.
                </p>
              </div>

              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-800 border border-neutral-300">
                Badge & Stamp Query
              </span>
            </div>

            <div className="relative">
              <Search className="w-5 h-5 text-neutral-400 absolute left-4 top-3.5 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by Badge ID (e.g. EFCC-89421) or paste copied Public Stamp (e.g. 04a8b92...)..."
                value={publicSearch}
                onChange={(e) => setPublicSearch(e.target.value)}
                className="w-full bg-[#f3f3f4] border border-neutral-300 rounded-xl pl-12 pr-4 py-3.5 text-sm text-black placeholder:text-neutral-400 outline-none focus:bg-white focus:border-black transition-all font-mono"
              />
            </div>

            {/* Quick Badge Suggestions */}
            {!publicSearch.trim() && (
              <div className="p-4 bg-[#f9f9fa] rounded-xl border border-neutral-200 text-xs space-y-2">
                <span className="text-neutral-500 font-semibold block text-[11px]">Try verifying sample active badge IDs:</span>
                <div className="flex flex-wrap gap-2 font-mono">
                  {["EFCC-89421", "NPF-33109", "ICPC-10294"].map((sampleOin) => (
                    <button
                      key={sampleOin}
                      onClick={() => setPublicSearch(sampleOin)}
                      className="px-3 py-1 bg-white hover:bg-neutral-100 border border-neutral-300 rounded-md text-black font-bold transition-all text-xs"
                    >
                      {sampleOin}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Verification Query Results */}
            {publicSearch.trim() && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                {publicFiltered.map((o) => (
                  <div key={o.oin} className="p-5 bg-[#f9f9fa] rounded-xl border border-neutral-200 space-y-3 text-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-mono text-[11px] font-bold text-black px-2 py-0.5 bg-neutral-200 rounded">
                          BADGE OIN: {o.oin}
                        </span>
                        <h3 className="font-bold text-black text-sm mt-2">{o.full_name}</h3>
                        <p className="text-neutral-500 text-[11px]">{o.rank || "Investigating Officer"}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        o.public_stamp
                          ? "bg-emerald-100 text-emerald-900 border-emerald-300"
                          : "bg-amber-100 text-amber-900 border-amber-300"
                      }`}>
                        {o.public_stamp ? "Stamp Verified" : "Stamp Pending"}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-neutral-200 space-y-1.5 text-[11px] font-mono">
                      <div className="text-neutral-700">
                        <span className="text-neutral-400">Agency: </span>
                        <strong className="text-black font-sans">{o.agency}</strong>
                      </div>

                      <div className="text-neutral-700 truncate">
                        <span className="text-neutral-400">Public Stamp: </span>
                        {o.public_stamp ? (
                          <strong className="text-black">{o.public_stamp.slice(0, 16)}…</strong>
                        ) : (
                          <span className="text-amber-700 italic font-sans font-medium">Pending Key Generation</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {publicSearch.trim() && publicFiltered.length === 0 && (
              <p className="text-xs text-neutral-500 italic text-center py-4 bg-[#f9f9fa] rounded-xl border border-neutral-200">
                No active badge found matching &quot;{publicSearch}&quot;.
              </p>
            )}
          </div>
        </section>

        {/* ── ACCESS SECTION ─────────────────────────────────────────────── */}
        <section className="py-20 max-w-5xl mx-auto px-6" id="access">
          <div className="rounded-xl border border-[#e4e4e7] bg-white p-8 sm:p-14 text-center">
            <h2 className="text-3xl sm:text-4xl font-semibold text-black tracking-[-0.025em] max-w-xl mx-auto">
              Access the Identity Portal
            </h2>
            <p className="mt-3 text-sm sm:text-base text-neutral-600 max-w-lg mx-auto leading-relaxed">
              Sign in to manage officer directory entries, issue digital identities, or generate ProofIt integration API bearer tokens.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setViewMode("login")}
                className="w-full sm:w-auto px-6 py-2.5 rounded-md text-sm font-medium text-white bg-black hover:bg-neutral-800 transition-colors shadow-sm inline-flex items-center justify-center gap-2"
              >
                <span>Sign in to Admin Portal</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <p className="mt-5 text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
              Central Law Enforcement Identity Authority • NIST P-256 Key Standard
            </p>
          </div>
        </section>

        {/* ── INSTITUTIONAL FOOTER ───────────────────────────────────────── */}
        <footer className="bg-white border-t border-[#e4e4e7] py-12 text-xs">
          <div className="max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-10 border-b border-neutral-100">
              <div className="col-span-2 space-y-3">
                <div className="flex items-center gap-2 text-black">
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-black text-white">
                    <ShieldCheck className="w-3.5 h-3.5 text-white" />
                  </span>
                  <span className="font-semibold text-sm tracking-tight text-black">ProofIt OIN Portal</span>
                </div>
                <p className="text-neutral-500 max-w-sm leading-relaxed text-xs">
                  Central Officer Identification Network provisioning public key stamps, badge attestation, and agency federation for digital evidence custody.
                </p>
              </div>
              
              <div>
                <h4 className="font-semibold text-black uppercase tracking-wider text-[11px] mb-3">System</h4>
                <div className="flex flex-col space-y-2 text-neutral-600">
                  <a className="hover:text-black transition-colors" href="#capabilities">Safeguards</a>
                  <a className="hover:text-black transition-colors" href="#challenge">Identity & Trust</a>
                  <a className="hover:text-black transition-colors" href="#standards">Compliance</a>
                  <button onClick={() => setViewMode("login")} className="text-left hover:text-black transition-colors">Admin Portal</button>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-black uppercase tracking-wider text-[11px] mb-3">Registry</h4>
                <div className="flex flex-col space-y-2 text-neutral-600">
                  <a className="hover:text-black transition-colors" href="#public-lookup">Badge Lookup</a>
                  <button onClick={() => setViewMode("login")} className="text-left hover:text-black transition-colors">Public Stamps</button>
                  <button onClick={() => setViewMode("login")} className="text-left hover:text-black transition-colors">Agency Federation</button>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-black uppercase tracking-wider text-[11px] mb-3">Compliance</h4>
                <div className="flex flex-col space-y-2 text-neutral-600">
                  <Link href="/" className="hover:text-black transition-colors">ProofIt App</Link>
                  <a className="hover:text-black transition-colors" href="#standards">NIST Standards</a>
                  <a className="hover:text-black transition-colors" href="#standards">CJIS Guidelines</a>
                </div>
              </div>
            </div>
            
            <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-neutral-400">
              <p>© 2025 ProofIt OIN Systems. Officer Identification & Key Registry Infrastructure.</p>
              <p className="font-mono text-[11px]">NIST ECDSA Identity Standard.</p>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     VIEW 2: ADMIN LOGIN SCREEN
     ───────────────────────────────────────────────────────────── */
  if (viewMode === "login") {
    return (
      <div className="bg-[#f9f9fa] text-[#1a1c1d] min-h-screen flex flex-col justify-between font-sans selection:bg-black selection:text-white">
        {/* Header */}
        <header className="pt-8 text-center px-6">
          <div className="max-w-6xl mx-auto flex items-center justify-between">
            <button onClick={() => setViewMode("landing")} className="inline-flex items-center gap-2 text-black tracking-tight font-semibold text-base focus:outline-none group">
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-black text-white shadow-xs group-hover:bg-neutral-800 transition-colors">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <span className="font-bold text-lg tracking-tight text-black">ProofIt OIN Portal</span>
            </button>

            <button
              onClick={() => setViewMode("landing")}
              className="px-3.5 py-1.5 rounded-md font-medium text-neutral-700 hover:text-black border border-neutral-300 bg-white hover:bg-neutral-50 transition-colors text-xs flex items-center gap-1.5"
            >
              <span>Back to OIN Landing</span>
            </button>
          </div>
        </header>

        {/* Admin Login Card */}
        <main className="w-full flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-xl border border-[#e4e4e7] p-8 flex flex-col relative space-y-6">
            
            <div className="flex items-center justify-between">
              <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center text-black border border-neutral-200">
                <Shield className="w-6 h-6 text-black" />
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-700">
                OIN Admin Gate
              </span>
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-black">OIN Portal Admin Sign In</h1>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                Central Officer Identification Network & ECDSA Public Stamp Directory. Sign in to manage law enforcement identities.
              </p>
            </div>

            {/* Seeded Admin Credentials Helper Banner */}
            <div className="p-4 bg-[#f9f9fa] border border-neutral-200 rounded-xl space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-black uppercase text-[10px] tracking-wider font-mono">Seeded Admin Credentials</span>
                <button
                  type="button"
                  onClick={fillSeededAdminCredentials}
                  className="text-[11px] font-bold text-black hover:underline flex items-center gap-1"
                >
                  <span>Auto-fill Credentials</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                <div>
                  <span className="text-neutral-500 block text-[10px]">Admin ID:</span>
                  <strong className="text-black">{SEEDED_ADMIN_ID}</strong>
                </div>
                <div>
                  <span className="text-neutral-500 block text-[10px]">Password:</span>
                  <strong className="text-black">{SEEDED_ADMIN_PASS}</strong>
                </div>
              </div>
            </div>

            {/* Login Form */}
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-800">Admin Officer ID (OID)</label>
                <input
                  type="text"
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                  placeholder="e.g. OIN-ADMIN-001"
                  className="w-full px-4 py-3 bg-[#f3f3f4] rounded-xl text-sm font-medium text-black placeholder:text-neutral-400 border border-transparent focus:border-neutral-400 focus:bg-white focus:outline-none transition-all"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-800">Admin Password</label>
                <input
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter admin password"
                  className="w-full px-4 py-3 bg-[#f3f3f4] rounded-xl text-sm font-medium text-black placeholder:text-neutral-400 border border-transparent focus:border-neutral-400 focus:bg-white focus:outline-none transition-all"
                  required
                />
              </div>

              {loginError && (
                <div className="p-3.5 rounded-xl text-xs font-medium bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 px-4 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-xl shadow-md flex items-center justify-center gap-2 transition-all"
              >
                <span>Access Identity Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>
        </main>

        <footer className="pb-8 text-center text-xs text-neutral-400">
          ProofIt Officer Identification Network • Identity Service Gate
        </footer>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     VIEW 3: ADMIN IDENTITY MANAGEMENT DASHBOARD
     ───────────────────────────────────────────────────────────── */
  return (
    <div className="bg-[#f9f9fa] text-[#1a1c1d] min-h-screen flex flex-col font-sans selection:bg-black selection:text-white">
      
      {/* ── HEADER NAVIGATION ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#e4e4e7]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setViewMode("landing")} className="w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center font-bold shadow-xs">
              <ShieldCheck className="w-5 h-5 text-white" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-black tracking-tight">OIN Identity Directory</h1>
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-neutral-100 text-black border border-neutral-200">
                  Admin Portal
                </span>
              </div>
              <p className="text-xs text-neutral-500">Central Law Enforcement Officer Identification Registry</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-neutral-100 border border-neutral-200 rounded-lg font-semibold text-black">
              <User className="w-3.5 h-3.5 text-neutral-600" />
              <span>Admin: {SEEDED_ADMIN_ID}</span>
            </div>

            <button
              onClick={handleAdminLogout}
              className="p-1.5 sm:px-3 sm:py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-600 hover:text-black font-semibold transition-colors flex items-center gap-1.5"
              title="Sign out of Admin Portal"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>

            <Link
              href="/"
              className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-neutral-800 text-white font-bold transition-all shadow-xs"
            >
              Open ProofIt App
            </Link>
          </div>
        </div>
      </header>

      {/* ── MAIN DASHBOARD CONTAINER ────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        
        {/* Stat Badges Overview Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-2xl p-5 border border-[#e4e4e7] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs text-neutral-500 uppercase tracking-wider font-mono">Total Enrolled Officers</span>
              <span className="text-2xl font-bold text-black mt-1 block">{officers.length}</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-black">
              <Users className="w-6 h-6 text-black" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#e4e4e7] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs text-neutral-500 uppercase tracking-wider font-mono">ECDSA Public Stamps</span>
              <span className="text-2xl font-bold text-black mt-1 block">{officers.filter(o => Boolean(o.public_stamp)).length} Active</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-black">
              <Lock className="w-6 h-6 text-black" />
            </div>
          </div>

          <div className="bg-white rounded-2xl p-5 border border-[#e4e4e7] shadow-xs flex items-center justify-between">
            <div>
              <span className="text-xs text-neutral-500 uppercase tracking-wider font-mono">Agencies Connected</span>
              <span className="text-2xl font-bold text-black mt-1 block">{uniqueAgenciesCount} Agencies</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-black">
              <Building2 className="w-6 h-6 text-black" />
            </div>
          </div>
        </div>

        {/* Tab Switcher & Refresh Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("directory")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "directory"
                  ? "bg-black text-white shadow-xs font-bold"
                  : "bg-white text-neutral-700 hover:text-black border border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Officer Roster Directory ({officers.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("enroll")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "enroll"
                  ? "bg-black text-white shadow-xs font-bold"
                  : "bg-white text-neutral-700 hover:text-black border border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Enroll New Identity</span>
            </button>

            <button
              onClick={() => setActiveTab("apikeys")}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === "apikeys"
                  ? "bg-black text-white shadow-xs font-bold"
                  : "bg-white text-neutral-700 hover:text-black border border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              <Key className="w-4 h-4" />
              <span>ProofIt Integration API Tokens</span>
            </button>
          </div>

          <button
            onClick={fetchOfficers}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-white hover:bg-neutral-100 text-neutral-700 rounded-xl border border-neutral-300 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-black" : ""}`} />
            <span>Refresh Directory</span>
          </button>
        </div>

        {/* ── TAB 1: OFFICER ROSTER DIRECTORY ────────────────────────── */}
        {activeTab === "directory" && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-neutral-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  placeholder="Search by OIN, name, or agency..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-white border border-neutral-300 rounded-xl pl-10 pr-4 py-2.5 text-xs text-black placeholder:text-neutral-400 outline-none focus:border-black transition-all"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((o) => (
                <div
                  key={o.oin}
                  className="bg-white border border-[#e4e4e7] rounded-2xl p-5 space-y-4 shadow-xs hover:border-black transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <span className="font-mono text-[11px] font-bold text-black px-2 py-0.5 bg-neutral-100 border border-neutral-200 rounded">
                          OIN: {o.oin}
                        </span>
                        <h3 className="text-base font-bold text-black mt-2">{o.full_name}</h3>
                        <p className="text-xs text-neutral-500">{o.rank || "Investigating Officer"}</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                        {o.status || "Active Badge"}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-neutral-100 text-xs">
                      <div className="flex items-center gap-2 text-neutral-700">
                        <Building2 className="w-3.5 h-3.5 text-neutral-500" />
                        <span className="font-semibold">{o.agency}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-neutral-600 font-mono text-[11px] bg-[#f9f9fa] p-2 rounded-lg border border-neutral-200">
                        <div className="truncate">
                          <span className="text-neutral-400">Stamp: </span>
                          <span className={o.public_stamp ? "text-black font-semibold" : "text-amber-700 italic font-sans"}>
                            {o.public_stamp ? `${o.public_stamp.slice(0, 16)}…` : "Pending Key Generation"}
                          </span>
                        </div>
                        {o.public_stamp ? (
                          <button
                            onClick={() => copyPublicStamp(o.public_stamp, o.oin)}
                            className="text-neutral-500 hover:text-black p-1 flex-shrink-0"
                            title="Copy Public Stamp Hash"
                          >
                            {copiedStampOin === o.oin ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        ) : (
                          <span className="text-[10px] font-bold font-sans text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200 flex-shrink-0">
                            No Stamp
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2">
                    <button
                      onClick={() => handleDeleteOfficer(o.oin, o.full_name)}
                      className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 font-semibold text-xs transition-colors flex items-center gap-1"
                      title="De-enroll officer from OIN database"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>De-enroll</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB 2: ENROLL NEW OFFICER ────────────────────────── */}
        {activeTab === "enroll" && (
          <div className="max-w-2xl mx-auto bg-white border border-[#e4e4e7] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="border-b border-neutral-100 pb-4">
              <h2 className="text-xl font-bold text-black">Enroll Officer into OIN Directory</h2>
              <p className="text-xs text-neutral-500 mt-1">
                Issues a verified Officer Identification Number (OIN) and registers their public security stamp.
              </p>
            </div>

            {statusMsg && (
              <div className={`p-4 rounded-xl text-xs font-semibold flex items-center gap-2 ${
                statusMsg.startsWith("Error")
                  ? "bg-rose-50 border border-rose-200 text-rose-800"
                  : "bg-emerald-50 border border-emerald-300 text-emerald-900"
              }`}>
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{statusMsg}</span>
              </div>
            )}

            <form onSubmit={handleEnroll} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">
                  Officer Identification Number (OIN) *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. EFCC-99201 or NPF-77402"
                  value={oin}
                  onChange={(e) => setOin(e.target.value)}
                  className="w-full bg-[#f3f3f4] border border-neutral-300 focus:border-black rounded-xl px-4 py-3 text-xs text-black outline-none focus:bg-white transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-800 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Inspector Grace Adebayo"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full bg-[#f3f3f4] border border-neutral-300 focus:border-black rounded-xl px-4 py-3 text-xs text-black outline-none focus:bg-white transition-all"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">Rank / Role</label>
                  <input
                    type="text"
                    placeholder="Senior Forensics Officer"
                    value={rank}
                    onChange={(e) => setRank(e.target.value)}
                    className="w-full bg-[#f3f3f4] border border-neutral-300 focus:border-black rounded-xl px-4 py-3 text-xs text-black outline-none focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1">Agency *</label>
                  <select
                    value={agency}
                    onChange={(e) => setAgency(e.target.value)}
                    className="w-full bg-[#f3f3f4] border border-neutral-300 focus:border-black rounded-xl px-4 py-3 text-xs text-black outline-none focus:bg-white transition-all"
                  >
                    <option value="EFCC Cybercrime Division">EFCC Cybercrime Division</option>
                    <option value="Nigeria Police Force - FCT">Nigeria Police Force</option>
                    <option value="ICPC Forensics Bureau">ICPC Forensics Bureau</option>
                    <option value="Department of State Services">Department of State Services</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-black hover:bg-neutral-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                {isSubmitting ? "Enrolling..." : "Enroll Officer & Issue Digital Identity"}
              </button>
            </form>
          </div>
        )}

        {/* ── TAB 3: PROOFIT API INTEGRATION KEYS ────────────────────────── */}
        {activeTab === "apikeys" && (
          <div className="max-w-2xl mx-auto bg-white border border-[#e4e4e7] rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="border-b border-neutral-100 pb-4">
              <h2 className="text-xl font-bold text-black flex items-center gap-2">
                <Key className="w-5 h-5 text-black" />
                ProofIt Integration API Bearer Token
              </h2>
              <p className="text-xs text-neutral-500 mt-1">
                ProofIt workstations connect to this OIN identity registry using an authorized Bearer API Token.
              </p>
            </div>

            <div className="p-5 bg-[#f9f9fa] border border-neutral-200 rounded-xl space-y-3">
              <span className="text-xs font-semibold text-neutral-500 block uppercase font-mono">Active OIN Integration Bearer Token</span>
              <div className="flex items-center justify-between bg-white border border-neutral-300 rounded-xl p-3 font-mono text-xs text-black">
                <span className="font-bold">{API_KEY}</span>
                <button
                  onClick={copyApiKey}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-black text-white hover:bg-neutral-800 rounded-lg text-xs font-sans font-bold transition-colors shadow-xs"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedKey ? "Copied!" : "Copy Token"}</span>
                </button>
              </div>
            </div>

            <div className="p-4 bg-neutral-100 border border-neutral-200 rounded-xl text-xs text-neutral-700 leading-relaxed font-mono">
              <strong className="text-black block font-sans text-xs mb-1">Integration Instructions:</strong>
              Include this Bearer token in the <strong className="text-black">Authorization: Bearer [TOKEN]</strong> header when making calls from ProofIt to <strong className="text-black">/api/officers</strong>.
            </div>
          </div>
        )}
      </main>

      {/* ── FOOTER ────────────────────────────────────────── */}
      <footer className="border-t border-[#e4e4e7] bg-white py-6 text-center text-xs text-neutral-500">
        ProofIt Officer Identification Network (OIN Portal) • Central Identity Directory
      </footer>
    </div>
  );
}

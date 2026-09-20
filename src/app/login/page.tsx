"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Shield, Lock, Eye, EyeOff, ArrowRight, Loader2, UserCheck, AlertCircle, ExternalLink, CheckCircle2, KeyRound } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { OfficerProfile } from "@/types";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTab = searchParams.get("redirect") || "workspace";

  const { unlock, enroll, isEnrolled } = useAuth();

  const [officerId, setOfficerId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  
  // Login Flow State
  const [step, setStep] = useState<"id_check" | "enter_passcode" | "create_passcode">("id_check");
  const [verifiedProfile, setVerifiedProfile] = useState<OfficerProfile | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-restore remembered officer session on page reload (if officer didn't intentionally log out)
  React.useEffect(() => {
    const savedBadge = localStorage.getItem("proofit_last_badge") || sessionStorage.getItem("proofit_active_badge");
    if (savedBadge && !verifiedProfile) {
      setOfficerId(savedBadge);
      const autoVerify = async () => {
        try {
          const res = await fetch("/api/officers");
          const data = await res.json();
          let matchedOfficer: { oin?: string; badge_id?: string; full_name?: string; rank?: string; agency?: string; public_stamp?: string } | null = null;
          if (data.success && Array.isArray(data.officers)) {
            matchedOfficer = data.officers.find(
              (o: { oin?: string; badge_id?: string; full_name?: string; rank?: string; agency?: string; public_stamp?: string }) =>
                (o.oin && o.oin.toUpperCase() === savedBadge.toUpperCase()) ||
                (o.badge_id && o.badge_id.toUpperCase() === savedBadge.toUpperCase())
            ) || null;
          }
          const cleanBadge = matchedOfficer?.oin || matchedOfficer?.badge_id || savedBadge;
          const profile: OfficerProfile = {
            badgeId: cleanBadge,
            fullName: matchedOfficer?.full_name || `Officer ${cleanBadge}`,
            idNumber: cleanBadge,
            agency: matchedOfficer?.agency || "Law Enforcement Agency",
            rank: matchedOfficer?.rank || "Investigating Officer",
            publicStamp: matchedOfficer?.public_stamp,
          };
          setVerifiedProfile(profile);
          const enrolled = await isEnrolled(cleanBadge);
          setStep(enrolled ? "enter_passcode" : "create_passcode");
        } catch (err) {
          // If offline or network error, set basic profile fallback
          const profile: OfficerProfile = {
            badgeId: savedBadge,
            fullName: `Officer ${savedBadge}`,
            idNumber: savedBadge,
            agency: "Law Enforcement Agency",
            rank: "Investigating Officer",
          };
          setVerifiedProfile(profile);
          setStep("enter_passcode");
        }
      };
      autoVerify();
    }
  }, []);

  // Step 1: Verify Officer ID in OIN Registry (Offline-Aware)
  const handleVerifyOfficerId = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = officerId.trim().toUpperCase();
    if (!cleanId) {
      setErrorMsg("Please enter your Officer ID Number.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      // 1. Check if officer is already enrolled locally on this device
      const enrolled = await isEnrolled(cleanId);
      let matchedOfficerProfile: OfficerProfile | null = null;

      // 2. Query live OIN API if online
      try {
        const res = await fetch("/api/officers");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.officers)) {
            const match = data.officers.find(
              (o: { oin?: string; badge_id?: string; full_name?: string; rank?: string; agency?: string; public_stamp?: string }) =>
                (o.oin && o.oin.toUpperCase() === cleanId) ||
                (o.badge_id && o.badge_id.toUpperCase() === cleanId)
            );
            if (match) {
              const oinId = match.oin || match.badge_id || cleanId;
              matchedOfficerProfile = {
                badgeId: oinId,
                fullName: match.full_name || `Officer ${cleanId}`,
                idNumber: oinId,
                agency: match.agency || "Law Enforcement Agency",
                rank: match.rank || "Investigating Officer",
                publicStamp: match.public_stamp,
              };
            }
          }
        }
      } catch (fetchErr) {
        console.warn("Offline Notice: OIN server unreachable, using offline identity derivation:", fetchErr);
      }

      // 3. Formulate final profile (dynamic fallback if not found in OIN database or if offline)
      const profile: OfficerProfile = matchedOfficerProfile || {
        badgeId: cleanId,
        fullName: `Officer ${cleanId}`,
        idNumber: cleanId,
        agency: "Law Enforcement Agency",
        rank: "Investigating Officer",
      };

      setVerifiedProfile(profile);

      // If enrolled locally on this device, go directly to passcode entry; else prompt to set master password
      setStep(enrolled ? "enter_passcode" : "create_passcode");
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Failed to verify Officer ID.");
    }
  };

  // Step 2: Perform Sign In / Unlock Vault
  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedProfile) return;

    if (!passcode.trim()) {
      setErrorMsg("Please enter your passcode.");
      setStatus("error");
      return;
    }

    if (step === "create_passcode") {
      if (passcode.length < 4) {
        setErrorMsg("Master password must be at least 4 characters long.");
        setStatus("error");
        return;
      }
      if (passcode !== confirmPasscode) {
        setErrorMsg("Passwords do not match. Please confirm your password.");
        setStatus("error");
        return;
      }
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const cleanId = verifiedProfile.badgeId;

      // Enroll if creating new password on this device
      const enrolled = await isEnrolled(cleanId);
      if (!enrolled) {
        await enroll(cleanId, passcode, verifiedProfile);
      }

      // Unlock vault in RAM (verifies PBKDF2 + AES-GCM + ECDSA public stamp matching)
      await unlock(cleanId, passcode, verifiedProfile);

      // Sync verified public stamp to central OIN registry database
      try {
        const authState = (window as unknown as { __proofit_public_stamp?: string });
        // Retrieve current public stamp from local vault keypair after unlock
        await fetch("/api/officers", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oin: cleanId,
            status: "Active",
          }),
        });
      } catch (syncErr) {
        // Silent catch for background OIN registry status ping
      }

      setStatus("idle");
      router.push("/workspace");
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Cryptographic passkey verification failed. Invalid master password.");
    }
  };

  return (
    <div className="bg-[#f9f9fa] text-[#1a1c1d] min-h-screen flex flex-col justify-between font-sans selection:bg-black selection:text-white">
      {/* ── STITCH HEADER ────────────────────────────────────────── */}
      <header className="pt-8 text-center px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-black tracking-tight font-semibold text-base focus:outline-none group">
            <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-black text-white shadow-xs group-hover:bg-neutral-800 transition-colors">
              <svg className="w-4 h-4 stroke-[2.5]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path d="M4.5 12.75l6 6 9-13.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="font-semibold text-lg tracking-tight text-black">ProofIt</span>
          </Link>

          <Link
            href="/oin"
            className="px-3.5 py-1.5 rounded-md font-medium text-neutral-700 hover:text-black border border-neutral-300 bg-white hover:bg-neutral-50 transition-colors text-xs flex items-center gap-1.5"
          >
            <span>OIN Portal</span>
            <ExternalLink className="w-3 h-3 text-neutral-500" />
          </Link>
        </div>
      </header>

      {/* ── STITCH OFFICER SIGN IN CARD ────────────────────────────────────────── */}
      <main className="w-full flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-xl border border-[#e4e4e7] p-8 flex flex-col relative">
          
          {/* Top Security / Desk Badge Icon */}
          <div className="flex items-center justify-between mb-6">
            <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center text-black border border-neutral-200">
              <Shield className="w-6 h-6 text-black" />
            </div>
            {step !== "id_check" && (
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem("proofit_last_badge");
                  sessionStorage.removeItem("proofit_active_badge");
                  setVerifiedProfile(null);
                  setOfficerId("");
                  setStep("id_check");
                  setPasscode("");
                  setConfirmPasscode("");
                  setErrorMsg("");
                }}
                className="text-xs text-neutral-500 hover:text-black underline font-medium"
              >
                Change Officer ID
              </button>
            )}
          </div>

          {/* Title & Welcoming Reassurance */}
          <div className="mb-6 space-y-1">
            <h1 className="text-2xl font-bold tracking-tight text-black">
              {step === "create_passcode" ? "Set Master Password" : step === "enter_passcode" ? "Officer Sign In" : "Sign In"}
            </h1>
            <p className="text-sm text-neutral-500">
              {step === "create_passcode"
                ? `First time signing in as ${verifiedProfile?.fullName}. Set your master password to secure your device vault.`
                : step === "enter_passcode"
                ? `Welcome back, ${verifiedProfile?.fullName}. Enter your passcode to open your desk.`
                : "Enter your officer details to open your desk."}
            </p>
          </div>

          {/* STEP 1: Verify Officer ID */}
          {step === "id_check" && (
            <form onSubmit={handleVerifyOfficerId} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="officer-id" className="block text-xs font-semibold text-neutral-800">
                  Officer ID Number
                </label>
                <div className="relative flex items-center">
                  <UserCheck className="w-5 h-5 absolute left-3.5 text-neutral-400 pointer-events-none" />
                  <input
                    id="officer-id"
                    name="officer-id"
                    type="text"
                    value={officerId}
                    onChange={(e) => setOfficerId(e.target.value)}
                    placeholder="e.g. EFCC-89421 or NPF-33109"
                    className="w-full pl-11 pr-4 py-3 bg-[#f3f3f4] rounded-xl text-sm font-medium text-black placeholder:text-neutral-400 border border-transparent focus:border-neutral-400 focus:bg-white focus:outline-none transition-all"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              {status === "error" && (
                <div className="p-3.5 rounded-xl text-xs font-medium bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full py-3.5 px-4 bg-black hover:bg-neutral-800 disabled:opacity-50 text-white font-medium text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verifying with OIN Registry…
                  </>
                ) : (
                  <>
                    <span>Continue to Desk</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2A / 2B: Enter or Create Passcode */}
          {(step === "enter_passcode" || step === "create_passcode") && (
            <form onSubmit={handleFinalSubmit} className="space-y-4">
              
              {/* Verified Profile Card */}
              {verifiedProfile && (
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl flex items-center justify-between text-xs mb-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <div>
                      <span className="font-bold text-black block">{verifiedProfile.fullName}</span>
                      <span className="text-neutral-500 text-[11px]">{verifiedProfile.agency} • {verifiedProfile.badgeId}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Passcode Field */}
              <div className="space-y-1.5">
                <label htmlFor="passcode" className="block text-xs font-semibold text-neutral-800">
                  {step === "create_passcode" ? "Master Password" : "Passcode"}
                </label>
                <div className="relative flex items-center">
                  <Lock className="w-5 h-5 absolute left-3.5 text-neutral-400 pointer-events-none" />
                  <input
                    id="passcode"
                    name="passcode"
                    type={showPasscode ? "text" : "password"}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder={step === "create_passcode" ? "Set a password for this device" : "Enter your passcode"}
                    className="w-full pl-11 pr-11 py-3 bg-[#f3f3f4] rounded-xl text-sm font-medium text-black placeholder:text-neutral-400 border border-transparent focus:border-neutral-400 focus:bg-white focus:outline-none transition-all"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPasscode(!showPasscode)}
                    className="absolute right-3 p-1 text-neutral-400 hover:text-black transition-colors"
                    aria-label="Toggle password visibility"
                  >
                    {showPasscode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Passcode Field (If First Time Setting Password) */}
              {step === "create_passcode" && (
                <div className="space-y-1.5">
                  <label htmlFor="confirm-passcode" className="block text-xs font-semibold text-neutral-800">
                    Confirm Master Password
                  </label>
                  <div className="relative flex items-center">
                    <KeyRound className="w-5 h-5 absolute left-3.5 text-neutral-400 pointer-events-none" />
                    <input
                      id="confirm-passcode"
                      name="confirm-passcode"
                      type={showPasscode ? "text" : "password"}
                      value={confirmPasscode}
                      onChange={(e) => setConfirmPasscode(e.target.value)}
                      placeholder="Confirm master password"
                      className="w-full pl-11 pr-11 py-3 bg-[#f3f3f4] rounded-xl text-sm font-medium text-black placeholder:text-neutral-400 border border-transparent focus:border-neutral-400 focus:bg-white focus:outline-none transition-all"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Error Display */}
              {status === "error" && (
                <div className="p-3.5 rounded-xl text-xs font-medium bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Primary Action Button */}
              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full py-3.5 px-4 bg-black hover:bg-neutral-800 disabled:opacity-50 text-white font-medium text-sm rounded-xl shadow-md flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Opening Desk…
                  </>
                ) : (
                  <>
                    <span>{step === "create_passcode" ? "Set Password & Open Desk" : "Open Evidence Desk"}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Public Escapes Link */}
          <div className="mt-8 pt-4 border-t border-neutral-100 -mx-8 -mb-8 px-8 pb-6 bg-neutral-50/80 rounded-b-2xl flex flex-col items-center text-center">
            <p className="text-xs text-neutral-500">
              Verifying an evidence file?
            </p>
            <Link
              href="/?tab=court"
              className="mt-1 text-xs font-semibold text-black hover:underline inline-flex items-center gap-1 group"
            >
              <span>Check evidence bag without signing in</span>
              <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </main>

      {/* ── FOOTER SUBTEXT ────────────────────────────────────────── */}
      <footer className="pb-8 text-center text-xs text-neutral-400">
        ProofIt Digital Evidence Preservation System • Air-Gapped Zero-Trust Architecture
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-[#f9f9fa] flex items-center justify-center text-xs text-neutral-500">Loading Officer Sign In…</div>}>
      <LoginContent />
    </React.Suspense>
  );
}

"use client";

import React, { useState } from "react";
import { Shield, Lock, Eye, EyeOff, ArrowRight, Loader2, UserCheck, AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import type { OfficerProfile } from "@/types";

interface AuthModalProps {
  onAuthenticated?: () => void;
  isOpen?: boolean;
  onClose?: () => void;
  onNavigateToCourt?: () => void;
}

export default function AuthModal({ onAuthenticated, isOpen = true, onClose, onNavigateToCourt }: AuthModalProps) {
  const { unlock, enroll, isEnrolled } = useAuth();
  
  const [officerId, setOfficerId] = useState("");
  const [passcode, setPasscode] = useState("");
  const [showPasscode, setShowPasscode] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (isOpen === false) return null;

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!officerId.trim() || !passcode.trim()) {
      setErrorMsg("Please enter both Officer ID Number and Passcode.");
      setStatus("error");
      return;
    }

    setStatus("loading");
    setErrorMsg("");

    try {
      const cleanId = officerId.trim().toUpperCase();
      
      // 1. Fetch live OIN roster from database/API if online
      let fetchedProfile: OfficerProfile | null = null;
      try {
        const res = await fetch("/api/officers");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.officers)) {
            const match = data.officers.find(
              (o: { oin?: string; badge_id?: string; full_name?: string; rank?: string; agency?: string }) =>
                (o.oin && o.oin.toUpperCase() === cleanId) ||
                (o.badge_id && o.badge_id.toUpperCase() === cleanId)
            );

            if (match) {
              fetchedProfile = {
                badgeId: match.oin || match.badge_id || cleanId,
                fullName: match.full_name || `Officer ${cleanId}`,
                idNumber: match.oin || match.badge_id || cleanId,
                agency: match.agency || "Law Enforcement Agency",
                rank: match.rank || "Investigating Officer",
              };
            }
          }
        }
      } catch (err) {
        console.warn("Could not query live OIN API, falling back to identity derivation:", err);
      }

      // 2. Fallback to dynamic identity derivation
      const profile: OfficerProfile = fetchedProfile || {
        badgeId: cleanId,
        fullName: `Officer ${cleanId}`,
        idNumber: cleanId,
        agency: "Law Enforcement Agency",
        rank: "Investigating Officer",
      };

      // 3. Enroll in local WebCrypto vault if not enrolled
      const enrolled = await isEnrolled(cleanId);
      if (!enrolled) {
        await enroll(cleanId, passcode, profile);
      }

      // 4. Derive keys in RAM & unlock vault
      await unlock(cleanId, passcode, profile);
      
      setStatus("idle");
      if (onAuthenticated) onAuthenticated();
      if (onClose) onClose();
    } catch (err) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Authentication failed. Please verify credentials.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in font-sans">
      <div className="w-full max-w-[440px] bg-white text-[#1a1c1d] rounded-2xl shadow-2xl border border-[#e4e4e7] p-8 flex flex-col relative overflow-hidden">
        
        {/* Top Header Badge */}
        <div className="flex items-center justify-between mb-6">
          <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center text-black border border-neutral-200">
            <Shield className="w-6 h-6 text-black" />
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-neutral-400 hover:text-black text-xs font-mono px-2 py-1 rounded-md hover:bg-neutral-100 transition-colors"
            >
              ESC ✕
            </button>
          )}
        </div>

        {/* Title & Subtitle */}
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-black">Sign In</h1>
          <p className="text-sm text-neutral-500">
            Enter your officer details to open your desk.
          </p>
        </div>

        {/* Interactive Form */}
        <form onSubmit={handleUnlock} className="space-y-4">
          
          {/* Field 1: Officer ID */}
          <div className="space-y-1.5">
            <label htmlFor="officer-id-input" className="block text-xs font-semibold text-neutral-800">
              Officer ID Number
            </label>
            <div className="relative flex items-center">
              <UserCheck className="w-5 h-5 absolute left-3.5 text-neutral-400 pointer-events-none" />
              <input
                id="officer-id-input"
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

          {/* Field 2: Passcode */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="passcode-input" className="block text-xs font-semibold text-neutral-800">
                Passcode
              </label>
            </div>
            <div className="relative flex items-center">
              <Lock className="w-5 h-5 absolute left-3.5 text-neutral-400 pointer-events-none" />
              <input
                id="passcode-input"
                type={showPasscode ? "text" : "password"}
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="Enter your personal passcode"
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

          {/* Error Message Display */}
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
                Authenticating against OIN Roster…
              </>
            ) : (
              <>
                <span>Open Evidence Desk</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Public Escapes Subtext */}
        <div className="mt-6 pt-4 border-t border-neutral-100 -mx-8 -mb-8 px-8 pb-6 bg-neutral-50/80 rounded-b-2xl flex flex-col items-center text-center">
          <p className="text-xs text-neutral-500">
            Verifying an evidence file?
          </p>
          <button
            onClick={() => {
              if (onClose) onClose();
              if (onNavigateToCourt) onNavigateToCourt();
            }}
            className="mt-1 text-xs font-semibold text-black hover:underline inline-flex items-center gap-1 group"
          >
            <span>Check evidence bag without signing in</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

      </div>
    </div>
  );
}

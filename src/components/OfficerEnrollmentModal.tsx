"use client";

import React, { useState } from "react";
import { UserPlus, Shield, CheckCircle2, KeyRound, Building2, User, X, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface OfficerEnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OfficerEnrollmentModal({ isOpen, onClose }: OfficerEnrollmentModalProps) {
  const { currentOfficer, enrollOfficer } = useAuth();
  const [oin, setOin] = useState<string>("");
  const [fullName, setFullName] = useState<string>("");
  const [rank, setRank] = useState<string>("");
  const [agency, setAgency] = useState<string>("EFCC Cybercrime Division");
  const [password, setPassword] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oin || !fullName || !password) return;

    setIsSubmitting(true);
    try {
      // 1. Enroll locally in Auth Context
      await enrollOfficer(
        {
          badgeId: oin,
          fullName,
          agency,
          rank: rank || "Investigating Officer",
          idNumber: "OIN/" + oin,
          nin: "oin_hash_" + oin,
        },
        password
      );

      // 2. Register via API with Bearer auth token
      const res = await fetch("/api/officers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer oin_live_sec_8f93e2b17a04c5d9e1823f4b6790a12c4e56",
        },
        body: JSON.stringify({
          oin,
          full_name: fullName,
          rank: rank || "Investigating Officer",
          agency,
          public_stamp: "",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(`Officer ${fullName} (${oin}) registered & unlocked!`);
        setTimeout(() => {
          setSuccessMessage("");
          onClose();
        }, 1200);
      }
    } catch (err) {
      console.error("Enrollment failed:", err);
    }
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="p-6 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Register Officer ID Badge</h3>
              <p className="text-xs text-slate-400">Verified Officer Identification System (OIN)</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {successMessage && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              {successMessage}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Officer Identification Number (OIN) *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. EFCC-99401 or NPF-88210"
              value={oin}
              onChange={(e) => setOin(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Inspector Grace Adebayo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Rank / Position</label>
              <input
                type="text"
                placeholder="Senior Analyst"
                value={rank}
                onChange={(e) => setRank(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Agency</label>
              <select
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white outline-none"
              >
                <option value="EFCC Cybercrime Division">EFCC Cybercrime</option>
                <option value="Nigeria Police Force">Nigeria Police Force</option>
                <option value="ICPC Forensics Bureau">ICPC Forensics</option>
                <option value="Nigerian Navy Cyber Unit">Navy Cyber Unit</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Officer Master Passcode *
            </label>
            <input
              type="password"
              required
              placeholder="Passcode to protect your digital stamp"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
              Register Officer & Unlock Stamp
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { Folder, Database, FileText, Clock, RefreshCw, AlertCircle, Shield, ChevronRight } from "lucide-react";

export interface SqlCase {
  id: string;
  case_number: string;
  title: string;
  agency: string;
  investigating_officer_badge: string;
  created_at: string;
  status: string;
  evidence_count: number;
}

export interface SqlEvidenceItem {
  id: string;
  case_id: string;
  evidence_id: string;
  original_filename: string;
  file_type: string;
  file_size_bytes: number;
  merkle_root: string;
  sealed_at: string;
  status: string;
}

interface CaseBrowserProps {
  onSelectCase?: (caseId: string, caseNumber: string) => void;
}

export function CaseBrowser({ onSelectCase }: CaseBrowserProps) {
  const [cases, setCases] = useState<SqlCase[]>([]);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [caseEvidence, setCaseEvidence] = useState<SqlEvidenceItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchCases = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/cases");
      const data = await res.json();
      if (data.success && Array.isArray(data.cases)) {
        setCases(data.cases);
        if (data.cases.length > 0 && !selectedCaseId) {
          setSelectedCaseId(data.cases[0].id);
        }
      }
    } catch (err) {
      console.error("Failed to load cases from SQLite:", err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchCases();
  }, []);

  useEffect(() => {
    if (!selectedCaseId) return;
    const fetchEvidence = async () => {
      try {
        const res = await fetch(`/api/evidence?caseId=${selectedCaseId}`);
        const data = await res.json();
        if (data.success && Array.isArray(data.items)) {
          setCaseEvidence(data.items);
        }
      } catch (err) {
        console.error("Failed to load case evidence:", err);
      }
    };
    fetchEvidence();
  }, [selectedCaseId]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              SQLite Persisted Case Roster
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-normal">
                Live SQLite Backend
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Simulated Law Enforcement Investigations (EFCC, NPF, ICPC)
            </p>
          </div>
        </div>

        <button
          onClick={fetchCases}
          className="flex items-center gap-2 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-emerald-400" : ""}`} />
          Refresh Database
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cases Column */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Select Active Case</h3>
          <div className="space-y-2">
            {cases.map((c) => {
              const isSelected = c.id === selectedCaseId;
              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setSelectedCaseId(c.id);
                    if (onSelectCase) onSelectCase(c.id, c.case_number);
                  }}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-slate-800/90 border-emerald-500/50 shadow-lg shadow-emerald-950/20"
                      : "bg-slate-950/60 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-mono text-xs font-bold text-emerald-400">{c.case_number}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">{c.agency}</span>
                  </div>
                  <h4 className="text-sm font-semibold text-white line-clamp-1">{c.title}</h4>
                  <div className="flex items-center justify-between text-xs text-slate-400 mt-3 pt-2 border-t border-slate-800/60">
                    <span className="flex items-center gap-1">
                      <Folder className="w-3.5 h-3.5 text-indigo-400" />
                      {c.evidence_count} Items
                    </span>
                    <span className="text-[11px] text-slate-500">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Evidence List for Selected Case */}
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Case Evidence Files in SQLite Persisted Storage
          </h3>

          <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 min-h-[220px]">
            {caseEvidence.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">
                No evidence sealed for this case yet. Use Intake Desk to seal evidence.
              </div>
            ) : (
              <div className="space-y-3">
                {caseEvidence.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-3.5 bg-slate-900/90 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-400">{ev.evidence_id}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {ev.status}
                          </span>
                        </div>
                        <h5 className="text-sm font-medium text-white">{ev.original_filename}</h5>
                        <p className="text-xs font-mono text-slate-400 mt-0.5">
                          Merkle Root: <span className="text-slate-300">{ev.merkle_root.slice(0, 16)}...</span>
                        </p>
                      </div>
                    </div>

                    <div className="text-right text-xs text-slate-400 self-end sm:self-center">
                      <div>{(ev.file_size_bytes / 1024).toFixed(1)} KB</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(ev.sealed_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

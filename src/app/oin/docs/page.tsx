"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Terminal, Copy, Check, Key, ShieldCheck, ArrowLeft } from "lucide-react";

interface Endpoint {
  id: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  title: string;
  description: string;
  authRequired: boolean;
  requestBody?: string;
  responseExample: string;
  getCurlExample: (baseUrl: string) => string;
  jsExample: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    id: "get-officers",
    method: "GET",
    path: "/api/officers",
    title: "Fetch OIN Officer Roster",
    description: "Returns the live roster of registered law enforcement officers and their ECDSA P-256 public stamps.",
    authRequired: false,
    responseExample: JSON.stringify({
      success: true,
      officers: [
        {
          oin: "NGP-001",
          full_name: "Inspector Adamu Bello",
          rank: "Inspector",
          agency: "Nigeria Police Force",
          nin_hash: "oin_hash_NGP-001",
          public_stamp: "048f93e2b17a04c5d9e1823f4b6790a12c4e56...",
          status: "Active"
        }
      ]
    }, null, 2),
    getCurlExample: (baseUrl) => `curl -X GET "${baseUrl}/api/officers"`,
    jsExample: `const res = await fetch("/api/officers");\nconst data = await res.json();\nconsole.log(data.officers);`
  },
  {
    id: "post-officers",
    method: "POST",
    path: "/api/officers",
    title: "Enroll Officer in OIN Directory",
    description: "Registers a new officer profile and public stamp in the OIN database.",
    authRequired: true,
    requestBody: JSON.stringify({
      oin: "EFCC-89421",
      full_name: "Detective Chukwuma Obi",
      rank: "Lead Detective",
      agency: "Economic & Financial Crimes Commission",
      public_stamp: "04a1b2c3d4e5f67890..."
    }, null, 2),
    responseExample: JSON.stringify({
      message: "Officer Detective Chukwuma Obi (EFCC-89421) registered successfully in OIN Portal",
      oin: "EFCC-89421",
      success: true
    }, null, 2),
    getCurlExample: (baseUrl) => `curl -X POST "${baseUrl}/api/officers" \\\n  -H "Authorization: Bearer oin_live_sec_8f93e2b17a04c5d9e1823f4b6790a12c4e56" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "oin": "EFCC-89421",\n    "full_name": "Detective Chukwuma Obi",\n    "rank": "Lead Detective",\n    "agency": "EFCC",\n    "public_stamp": "04a1b2c3d4e5f67890..."\n  }'`,
    jsExample: `const res = await fetch("/api/officers", {\n  method: "POST",\n  headers: {\n    "Authorization": "Bearer oin_live_sec_8f93e2b17a04c5d9e1823f4b6790a12c4e56",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    oin: "EFCC-89421",\n    full_name: "Detective Chukwuma Obi",\n    rank: "Lead Detective",\n    agency: "EFCC",\n    public_stamp: "04a1b2c3d4e5f67890..."\n  })\n});\nconst data = await res.json();`
  },
  {
    id: "get-cases",
    method: "GET",
    path: "/api/cases",
    title: "List Evidence Cases",
    description: "Fetch registered evidence cases and search by case number or officer badge ID.",
    authRequired: false,
    responseExample: JSON.stringify({
      success: true,
      cases: [
        {
          id: "CASE-10492",
          case_number: "CASE-10492",
          title: "Cyber Fraud Investigation",
          agency: "EFCC Cybercrime Division",
          investigating_officer_badge: "EFCC-001",
          created_at: "2026-09-19T14:00:00.000Z",
          status: "Active"
        }
      ]
    }, null, 2),
    getCurlExample: (baseUrl) => `curl -X GET "${baseUrl}/api/cases"`,
    jsExample: `const res = await fetch("/api/cases");\nconst data = await res.json();\nconsole.log(data.cases);`
  },
  {
    id: "post-custody",
    method: "POST",
    path: "/api/custody",
    title: "Append Custody Audit Record",
    description: "Appends an ECDSA signed handover record to the central evidence ledger.",
    authRequired: false,
    requestBody: JSON.stringify({
      evidence_id: "EVD-CASE-10492",
      timestamp: "2026-09-19T15:00:00.000Z",
      actor_badge_id: "NGP-001",
      actor_name: "Inspector Adamu Bello",
      action: "Container Handover",
      notes: "Transferred custody to forensic laboratory",
      canonical_hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      signature: "MEUCIQD...",
      public_stamp: "048f93e2b17a04c5d9e1823f4b6790a12c4e56..."
    }, null, 2),
    responseExample: JSON.stringify({
      success: true,
      message: "Custody record signed and appended successfully."
    }, null, 2),
    getCurlExample: (baseUrl) => `curl -X POST "${baseUrl}/api/custody" \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "evidence_id": "EVD-CASE-10492",\n    "timestamp": "2026-09-19T15:00:00.000Z",\n    "actor_badge_id": "NGP-001",\n    "actor_name": "Inspector Adamu Bello",\n    "action": "Container Handover",\n    "notes": "Transferred custody to forensic laboratory",\n    "canonical_hash": "e3b0c4...",\n    "signature": "MEUCIQD...",\n    "public_stamp": "048f93..."\n  }'`,
    jsExample: `const res = await fetch("/api/custody", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ evidence_id: "EVD-101", ... })\n});`
  },
  {
    id: "post-sync",
    method: "POST",
    path: "/api/sync",
    title: "Sync Offline Custody Ledger",
    description: "Synchronizes offline custody records created during air-gapped operations.",
    authRequired: false,
    requestBody: JSON.stringify({
      case_id: "CASE-10492",
      records: [
        {
          evidence_id: "EVD-101",
          timestamp: "2026-09-19T14:30:00.000Z",
          actor_badge_id: "EFCC-001",
          actor_name: "Detective Chukwuma Obi",
          action: "Field Sealing",
          notes: "Initial evidence sealing in field",
          canonical_hash: "a4f8...",
          signature: "EYz...",
          public_stamp: "04a1..."
        }
      ]
    }, null, 2),
    responseExample: JSON.stringify({
      success: true,
      syncedCount: 1,
      message: "Offline custody records synchronized to central database."
    }, null, 2),
    getCurlExample: (baseUrl) => `curl -X POST "${baseUrl}/api/sync" \\\n  -H "Content-Type: application/json" \\\n  -d '{"case_id": "CASE-10492", "records": [...]}'`,
    jsExample: `const res = await fetch("/api/sync", {\n  method: "POST",\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify({ case_id: "CASE-10492", records: [...] })\n});`
  }
];

export default function OinApiDocsPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>(ENDPOINTS[0]);
  const [activeCodeTab, setActiveCodeTab] = useState<"curl" | "js" | "response">("curl");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string>("https://proofit-lilac.vercel.app");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#f9f9fa] text-[#1a1c1d] flex flex-col font-sans selection:bg-black selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#e4e4e7]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/oin"
              className="flex items-center gap-2 text-black tracking-tight font-semibold text-sm focus:outline-none group"
            >
              <span className="inline-flex items-center justify-center w-7 h-7 rounded-md bg-black text-white shadow-xs group-hover:bg-neutral-800 transition-colors">
                <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
              </span>
              <span className="font-bold text-lg tracking-tight text-black">OIN Portal</span>
            </Link>
            <span className="text-neutral-300">|</span>
            <span className="text-xs font-semibold text-neutral-600 font-mono">API Documentation</span>
          </div>

          <Link
            href="/oin"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-neutral-700 hover:text-black border border-neutral-300 bg-white hover:bg-neutral-50 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to OIN Portal</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        
        {/* Title */}
        <div className="border-b border-neutral-200 pb-6 space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-200 text-neutral-800 text-xs font-semibold">
            <Terminal className="w-3.5 h-3.5 text-black" />
            <span>OIN Developer Reference</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-black">
            OIN API Documentation
          </h1>
          <p className="text-xs sm:text-sm text-neutral-600 max-w-3xl leading-relaxed">
            RESTful API endpoints for querying officer identity rosters, registering public stamps, appending custody records, and synchronizing evidence passports.
          </p>
        </div>

        {/* Clean Flex Layout — Fixed Sidebar Width to avoid squishing */}
        <div className="flex flex-col lg:flex-row items-start gap-8">
          
          {/* Left Sidebar: Endpoints List */}
          <div className="w-full lg:w-80 flex-shrink-0 bg-white rounded-2xl p-4 shadow-xs border border-[#e4e4e7] space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 px-2 font-mono">
              Endpoints ({ENDPOINTS.length})
            </h3>

            <div className="space-y-1.5">
              {ENDPOINTS.map((ep) => {
                const isSelected = selectedEndpoint.id === ep.id;
                return (
                  <button
                    key={ep.id}
                    onClick={() => setSelectedEndpoint(ep)}
                    className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? "bg-neutral-100 border-black font-bold text-black shadow-xs"
                        : "bg-neutral-50 border-neutral-200 hover:bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <span className="font-bold text-black block truncate text-xs">{ep.title}</span>
                      <span className="text-[11px] text-neutral-500 font-mono block truncate mt-0.5">{ep.path}</span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono flex-shrink-0 ${
                        ep.method === "GET"
                          ? "bg-emerald-100 text-emerald-900"
                          : ep.method === "POST"
                          ? "bg-blue-100 text-blue-900"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {ep.method}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Content Area: Detailed Endpoint Inspector */}
          <div className="flex-1 min-w-0 w-full bg-white rounded-2xl p-6 sm:p-8 shadow-xs border border-[#e4e4e7] space-y-6">
            
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-100 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase font-mono ${
                      selectedEndpoint.method === "GET"
                        ? "bg-emerald-100 text-emerald-900"
                        : selectedEndpoint.method === "POST"
                        ? "bg-blue-100 text-blue-900"
                        : "bg-amber-100 text-amber-900"
                    }`}
                  >
                    {selectedEndpoint.method}
                  </span>
                  <span className="font-mono text-sm font-bold text-black">{selectedEndpoint.path}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-black">{selectedEndpoint.title}</h2>
              </div>

              {selectedEndpoint.authRequired && (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold self-start sm:self-auto flex-shrink-0">
                  <Key className="w-3.5 h-3.5 text-rose-600" />
                  <span>Bearer Key Required</span>
                </div>
              )}
            </div>

            {/* Description */}
            <p className="text-xs sm:text-sm text-neutral-600 leading-relaxed">
              {selectedEndpoint.description}
            </p>

            {/* Request Payload */}
            {selectedEndpoint.requestBody && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono">
                  Request Payload (JSON)
                </h4>
                <pre className="bg-[#1a1c1d] text-emerald-400 text-xs font-mono p-4 rounded-xl overflow-x-auto border border-neutral-800">
                  {selectedEndpoint.requestBody}
                </pre>
              </div>
            )}

            {/* Code Examples Tabs */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-200 pb-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveCodeTab("curl")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      activeCodeTab === "curl"
                        ? "bg-black text-white"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    cURL Command
                  </button>
                  <button
                    onClick={() => setActiveCodeTab("js")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      activeCodeTab === "js"
                        ? "bg-black text-white"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    JavaScript (fetch)
                  </button>
                  <button
                    onClick={() => setActiveCodeTab("response")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      activeCodeTab === "response"
                        ? "bg-black text-white"
                        : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                    }`}
                  >
                    Sample Response
                  </button>
                </div>

                <button
                  onClick={() => {
                    const text =
                      activeCodeTab === "curl"
                        ? selectedEndpoint.getCurlExample(baseUrl)
                        : activeCodeTab === "js"
                        ? selectedEndpoint.jsExample
                        : selectedEndpoint.responseExample;
                    handleCopy(text, selectedEndpoint.id + activeCodeTab);
                  }}
                  className="px-3 py-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-semibold flex items-center gap-1.5 transition-colors border border-neutral-300 cursor-pointer"
                >
                  {copiedId === selectedEndpoint.id + activeCodeTab ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              {/* Code Box */}
              <div className="bg-[#1a1c1d] rounded-xl overflow-hidden border border-neutral-800 p-4">
                <pre className="text-xs font-mono leading-relaxed overflow-x-auto text-emerald-400">
                  {activeCodeTab === "curl" && selectedEndpoint.getCurlExample(baseUrl)}
                  {activeCodeTab === "js" && selectedEndpoint.jsExample}
                  {activeCodeTab === "response" && selectedEndpoint.responseExample}
                </pre>
              </div>
            </div>

          </div>

        </div>

      </main>

      <footer className="border-t border-[#e4e4e7] bg-white py-6 text-center text-xs text-neutral-500 mt-12">
        OIN Directory REST API Specification • FIPS 186-4 ECDSA Directory Engine
      </footer>
    </div>
  );
}

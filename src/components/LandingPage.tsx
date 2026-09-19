"use client";

import React from "react";
import Link from "next/link";
import { Shield, ArrowRight, Check, History, Laptop, Files, Award, Network, FolderArchive, Gavel, FileCheck } from "lucide-react";

interface LandingPageProps {
  onOpenWorkspace?: (tab?: "workspace" | "court" | "tamper") => void;
}

export default function LandingPage({ onOpenWorkspace }: LandingPageProps = {}) {
  return (
    <div className="bg-[#f9f9fa] text-[#1a1c1d] font-sans antialiased min-h-screen">
      <section className="pt-16 pb-16 sm:pt-24 sm:pb-20 max-w-5xl mx-auto px-6 text-center">
        
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-semibold tracking-[-0.035em] text-black leading-[1.08] max-w-4xl mx-auto">
          A reliable, unbroken custody record for digital evidence.
        </h1>
        <p className="mt-6 text-base sm:text-lg text-neutral-600 leading-relaxed max-w-2xl mx-auto font-normal tracking-[-0.01em]">
          ProofIt provides public agencies, law enforcement, and judicial panels with a uniform system to package files, record every transfer, and confirm original authenticity.
        </p>

        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3.5">
          <Link
            href="/login?redirect=/workspace"
            className="w-full sm:w-auto px-5 py-2.5 rounded-md text-sm font-medium text-white bg-black hover:bg-neutral-800 transition-colors shadow-sm inline-flex items-center justify-center gap-2"
          >
            <span>Sign in to Dashboard</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          
          <a
            href="#standards"
            className="w-full sm:w-auto px-5 py-2.5 rounded-md text-sm font-medium text-neutral-800 bg-white border border-neutral-300 hover:bg-neutral-50 transition-colors inline-flex items-center justify-center gap-2"
          >
            <span>View Standards</span>
          </a>

          <Link
            href="/verify"
            className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-neutral-500 hover:text-black transition-colors inline-flex items-center justify-center"
          >
            Verify Case Container →
          </Link>
        </div>

        {/* Context Certificate Preview (Editorial Ledger Slip) */}
        <div className="mt-16 max-w-2xl mx-auto text-left">
          <div className="rounded-xl border border-[#e4e4e7] bg-white shadow-[0_4px_20px_-8px_rgba(0,0,0,0.06)] p-6 sm:p-7">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-100 mb-5">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-neutral-900"></span>
                <span className="text-xs font-semibold uppercase tracking-wider text-black">Official Evidentiary Ledger Record</span>
              </div>
              <span className="font-mono text-[11px] text-neutral-400 tracking-tight">CASE REF: #EV-2025-0841</span>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
              <div className="sm:col-span-4 aspect-[4/3] rounded-md bg-neutral-50 border border-neutral-200 overflow-hidden flex flex-col justify-center items-center p-3 text-center">
                <FolderArchive className="text-neutral-500 w-8 h-8 mb-1" />
                <span className="text-[11px] font-mono text-neutral-700 font-medium">CONTAINER.PRF</span>
                <span className="text-[10px] font-mono text-neutral-400">Master + Dual-Copy</span>
              </div>
              
              <div className="sm:col-span-8 space-y-2">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-neutral-400 font-medium">Ledger Validation Status</div>
                  <div className="text-sm font-semibold text-black flex items-center gap-1.5 mt-0.5">
                    <Check className="w-4 h-4 text-black inline stroke-[3]" />
                    Unbroken Chain of Custody Confirmed
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3 pt-1 text-xs">
                  <div>
                    <span className="text-neutral-400 block text-[10px]">Intake Timestamp</span>
                    <span className="font-mono text-neutral-800 text-[11px]">2025-05-18 14:22 UTC</span>
                  </div>
                  <div>
                    <span className="text-neutral-400 block text-[10px]">Verified Transfers</span>
                    <span className="font-mono text-neutral-800 text-[11px]">4 Signatures (Sequential)</span>
                  </div>
                </div>
                
                <div className="pt-2 text-[11px] font-mono text-neutral-500 flex items-center justify-between border-t border-neutral-100">
                  <span>Integrity: Zero Discrepancies</span>
                  <span className="text-black font-medium">Station Registry Confirmed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white border-t border-b border-[#e4e4e7]" id="challenge">
        <div className="max-w-4xl mx-auto px-6">
          <div className="max-w-2xl mb-10">
            <h2 className="text-3xl sm:text-4xl font-semibold text-black tracking-[-0.025em]">The Administrative Challenge</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            <div className="md:col-span-8 space-y-5 text-neutral-600 leading-relaxed text-base sm:text-[17px]">
              <p>
                As digital evidence moves between field investigators, station desks, legal officers, and the court, keeping an accurate record of possession becomes difficult. Files are routinely transferred across unmonitored flash drives and personal messages without a continuous custody log.
              </p>
              <p>
                When records are incomplete, proceedings stall over basic questions of who handled an exhibit, whether the material was altered, or why parts of a file were redacted.
              </p>
            </div>
            
            <div className="md:col-span-4 p-5 rounded-lg border border-[#e4e4e7] bg-[#f9f9fa] space-y-4">
              <div className="text-xs font-mono text-neutral-400 uppercase tracking-wider">Custody Disruption Risks</div>
              <div className="space-y-3 text-xs text-neutral-700">
                <div className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 mt-1.5 flex-shrink-0"></span>
                  <span>Untracked transfers across unmonitored physical drives</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 mt-1.5 flex-shrink-0"></span>
                  <span>Protracted judicial challenges regarding exhibit provenance</span>
                </div>
                <div className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 mt-1.5 flex-shrink-0"></span>
                  <span>Ambiguous redaction history lacking matched master records</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 max-w-6xl mx-auto px-6" id="capabilities">
        <div className="max-w-2xl mb-12">
          <h2 className="text-3xl sm:text-4xl font-semibold text-black tracking-[-0.025em]">System Capabilities</h2>
          <p className="mt-3 text-neutral-600 text-sm sm:text-base leading-relaxed">
            Four administrative safeguards designed to maintain evidentiary value from initial intake through final judicial determination.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Capability 1 */}
          <div className="p-8 rounded-lg border border-[#e4e4e7] bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs text-neutral-400 tracking-wider">CAPABILITY / 01</span>
                <History className="text-neutral-700 w-5 h-5" />
              </div>
              <h3 className="text-xl font-semibold text-black tracking-tight mb-3">Continuous Custody Logging</h3>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Every transfer of custody requires an official entry that binds to the existing record. The result is a strictly ordered history of possession where past steps cannot be reordered, deleted, or inserted after the fact.
              </p>
            </div>
          </div>

          {/* Capability 2 */}
          <div className="p-8 rounded-lg border border-[#e4e4e7] bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs text-neutral-400 tracking-wider">CAPABILITY / 02</span>
                <Laptop className="text-neutral-700 w-5 h-5" />
              </div>
              <h3 className="text-xl font-semibold text-black tracking-tight mb-3">Complete Local Operation</h3>
              <p className="text-sm text-neutral-600 leading-relaxed">
                The system operates independently on local hardware. Investigative units and review registries can process, update, and review evidence packages without network connectivity or external servers.
              </p>
            </div>
          </div>

          {/* Capability 3 */}
          <div className="p-8 rounded-lg border border-[#e4e4e7] bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs text-neutral-400 tracking-wider">CAPABILITY / 03</span>
                <Files className="text-neutral-700 w-5 h-5" />
              </div>
              <h3 className="text-xl font-semibold text-black tracking-tight mb-3">Dual-Record Privacy Handling</h3>
              <p className="text-sm text-neutral-600 leading-relaxed">
                When operational guidelines or privacy laws require masking bystander identities or sensitive numbers, the platform pairs the approved viewing copy with the untouched master file in a single package.
              </p>
            </div>
          </div>

          {/* Capability 4 */}
          <div className="p-8 rounded-lg border border-[#e4e4e7] bg-white flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs text-neutral-400 tracking-wider">CAPABILITY / 04</span>
                <Award className="text-neutral-700 w-5 h-5" />
              </div>
              <h3 className="text-xl font-semibold text-black tracking-tight mb-3">Immediate Authenticity Confirmation</h3>
              <p className="text-sm text-neutral-600 leading-relaxed">
                Reviewing an exhibit provides an immediate determination of whether the record remains identical to its intake state or shows discrepancies in its handling history.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 bg-white border-t border-b border-[#e4e4e7]" id="standards">
        <div className="max-w-5xl mx-auto px-6">
          <div className="max-w-2xl mb-12">
            <h2 className="text-3xl sm:text-4xl font-semibold text-black tracking-[-0.025em]">Core Standards</h2>
            <p className="mt-3 text-neutral-600 text-sm sm:text-base leading-relaxed">
              Standardized operational criteria implemented across all jurisdictional deployments.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-8 rounded-lg border border-[#e4e4e7] bg-[#f9f9fa] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs text-neutral-400 tracking-wider">STANDARD / 01</span>
                <Network className="text-neutral-700 w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-black tracking-tight mb-2">Institutional Autonomy</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">Operates entirely on local department hardware. No reliance on external internet connections, wide-area networks, or third-party cloud infrastructure.</p>
              </div>
            </div>

            <div className="p-8 rounded-lg border border-[#e4e4e7] bg-[#f9f9fa] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs text-neutral-400 tracking-wider">STANDARD / 02</span>
                <FolderArchive className="text-neutral-700 w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-black tracking-tight mb-2">Unified Record Preservation</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">The original evidence file and its complete custody record remain sealed together in a single container. The history cannot be separated from the material itself.</p>
              </div>
            </div>

            <div className="p-8 rounded-lg border border-[#e4e4e7] bg-[#f9f9fa] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs text-neutral-400 tracking-wider">STANDARD / 03</span>
                <Gavel className="text-neutral-700 w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-black tracking-tight mb-2">Absolute Chain Integrity</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">Every custodial handover is final and permanent. Any missing step, unrecorded transfer, or altered file is identified immediately upon review.</p>
              </div>
            </div>

            <div className="p-8 rounded-lg border border-[#e4e4e7] bg-[#f9f9fa] flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <span className="font-mono text-xs text-neutral-400 tracking-wider">STANDARD / 04</span>
                <FileCheck className="text-neutral-700 w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-black tracking-tight mb-2">Procedural Compliance</h3>
                <p className="text-sm text-neutral-600 leading-relaxed">Produces a standardized, plain-language custody record designed to meet statutory requirements before administrative panels, tribunals, and courts.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="py-20 max-w-5xl mx-auto px-6" id="access">
        <div className="rounded-xl border border-[#e4e4e7] bg-white p-8 sm:p-14 text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold text-black tracking-[-0.025em] max-w-xl mx-auto">
            Access the System
          </h2>
          <p className="mt-3 text-sm sm:text-base text-neutral-600 max-w-lg mx-auto leading-relaxed">
            Log in to register new exhibits, record a transfer, or verify an existing case container.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-2.5 rounded-md text-sm font-medium text-white bg-black hover:bg-neutral-800 transition-colors shadow-sm inline-flex items-center justify-center"
            >
              Sign in to Dashboard
            </Link>
          </div>
          <p className="mt-5 text-[11px] font-mono text-neutral-400 uppercase tracking-wider">
            Standardized Custody Ledger • ISO/IEC Compliant Provenance Schema
          </p>
        </div>
      </section>

      <footer className="bg-white border-t border-[#e4e4e7] py-12 text-xs">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-10 border-b border-neutral-100">
            <div className="col-span-2 space-y-3">
              <div className="flex items-center gap-2 text-black">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-black text-white">
                  <Shield className="w-3 h-3 text-white" />
                </span>
                <span className="font-semibold text-sm tracking-tight text-black">ProofIt</span>
              </div>
              <p className="text-neutral-500 max-w-sm leading-relaxed text-xs">
                Uniform evidence packaging, immutable chain-of-custody ledgers, and on-device authenticity validation for judicial and administrative agencies.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-black uppercase tracking-wider text-[11px] mb-3">System</h4>
              <div className="flex flex-col space-y-2 text-neutral-600">
                <a className="hover:text-black transition-colors" href="#capabilities">Capabilities</a>
                <a className="hover:text-black transition-colors" href="#challenge">The Challenge</a>
                <a className="hover:text-black transition-colors" href="#standards">Core Standards</a>
                <Link href="/workspace" className="text-left hover:text-black transition-colors">Dashboard Access</Link>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-black uppercase tracking-wider text-[11px] mb-3">Custody</h4>
              <div className="flex flex-col space-y-2 text-neutral-600">
                <Link href="/workspace" className="text-left hover:text-black transition-colors">Local Operations</Link>
                <Link href="/verify" className="text-left hover:text-black transition-colors">Container Validation</Link>
                <Link href="/verify" className="text-left hover:text-black transition-colors">Verification Reporting</Link>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-black uppercase tracking-wider text-[11px] mb-3">Compliance</h4>
              <div className="flex flex-col space-y-2 text-neutral-600">
                <Link className="hover:text-black transition-colors" href="/oin">OIN Portal</Link>
                <a className="hover:text-black transition-colors" href="#standards">Chain Rules</a>
                <a className="hover:text-black transition-colors" href="#standards">ISO Standards</a>
              </div>
            </div>
          </div>
          
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-neutral-400">
            <p>© 2025 ProofIt Systems. Uniform Digital Evidence & Custody Infrastructure.</p>
            <p className="font-mono text-[11px]">ISO-Compatible Custodial Architecture.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

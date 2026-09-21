"use client";

import React, { useState, useRef } from "react";
import {
  ShieldCheck, Upload, Clock, User, Building2,
  Hash, FileText, Loader2, CheckCircle2, XCircle, EyeOff, Lock,
  Download, Printer, Copy, Check, ArrowUpRight, FolderOpen, X
} from "lucide-react";
import { unpackProof } from "@/modules/container/unpack";
import { verifyProof } from "@/modules/verifier/verify";
import type { Passport, VerificationResult, CustodyRecord } from "@/types";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface CourtReviewProps {
  onVerified?: (passport: Passport, result: VerificationResult) => void;
}

export default function CourtReview({ onVerified }: CourtReviewProps = {}) {
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [passport, setPassport] = useState<Passport | null>(null);
  const [originalMedia, setOriginalMedia] = useState<File | null>(null);
  const [derivativesList, setDerivativesList] = useState<File[]>([]);
  const [finalPayload, setFinalPayload] = useState<File | null>(null);
  const [isDerivative, setIsDerivative] = useState<boolean>(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [status, setStatus] = useState<"idle" | "verifying" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState<string | null>(null);
  const [showCertModal, setShowCertModal] = useState<boolean>(false);
  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false);

  const proofRef = useRef<HTMLInputElement>(null);
  const printCertRef = useRef<HTMLDivElement>(null);

  const triggerFileDownload = (file: File) => {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (!passport) return;
    setIsExportingPdf(true);

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 210;
      let y = 15;

      // Header Title
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(16);
      pdf.text("OFFICIAL EVIDENTIARY CERTIFICATE", 14, y);
      
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(80, 80, 80);
      pdf.text("Institutional Digital Evidence Chain-of-Custody Certificate", 14, y + 5);

      // Cert Serial & Status
      pdf.setFont("courier", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(0, 0, 0);
      const caseRefStr = (passport.case_id || "CASE").toUpperCase();
      pdf.text(`CERT REF: CERT-EVD-${caseRefStr}`, pageWidth - 14, y, { align: "right" });
      pdf.text(`ISSUED: ${new Date().toLocaleDateString()}`, pageWidth - 14, y + 5, { align: "right" });

      const statusText = result?.overall ? "VERIFIED AUTHENTIC" : "TAMPERED / FAILED";
      if (result?.overall) {
        pdf.setTextColor(4, 120, 87);
      } else {
        pdf.setTextColor(185, 28, 28);
      }
      pdf.text(`STATUS: ${statusText}`, pageWidth - 14, y + 10, { align: "right" });

      pdf.setTextColor(0, 0, 0);
      y += 16;
      pdf.setLineWidth(0.5);
      pdf.line(14, y, pageWidth - 14, y);
      y += 8;

      // Section 1: Specifications
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text("SECTION 1: PRIMARY EVIDENCE EXHIBIT SPECIFICATIONS", 14, y);
      y += 6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      
      const originalName = passport.evidenceMetadata?.originalFileName || originalMedia?.name || passport.blueprint?.original_filename || "N/A";
      const fileSizeMB = ((originalMedia?.size || passport.evidenceMetadata?.fileSizeBytes || passport.blueprint?.total_file_size || 0) / 1024 / 1024).toFixed(2);
      const sealedDate = passport.evidenceMetadata?.sealedAtTimestamp ? new Date(passport.evidenceMetadata.sealedAtTimestamp).toLocaleString() : "N/A";
      const officerName = custodyHistory[0]?.data?.full_name || custodyHistory[0]?.actorName || "Authorized Officer";
      const badgeId = custodyHistory[0]?.data?.id_number || custodyHistory[0]?.actorBadgeId || "N/A";

      pdf.text(`• Case Reference: ${passport.case_id}`, 16, y);
      pdf.text(`• Initial Sealing Date: ${sealedDate}`, 110, y);
      y += 5;

      pdf.text(`• Primary File Name: ${originalName}`, 16, y);
      pdf.text(`• Primary File Size: ${fileSizeMB} MB`, 110, y);
      y += 5;

      pdf.text(`• Sealing Officer: ${officerName}`, 16, y);
      pdf.text(`• Officer Badge ID: ${badgeId}`, 110, y);
      y += 6;

      pdf.setFont("courier", "normal");
      pdf.setFontSize(8);
      pdf.text(`• Merkle Root (SHA-256): ${passport.blueprint?.root_fingerprint || "N/A"}`, 16, y);
      y += 8;
      pdf.line(14, y, pageWidth - 14, y);
      y += 8;

      // Section 2: Enclosed Files
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      const totalFiles = 1 + (derivativesList ? derivativesList.length : 0);
      pdf.text(`SECTION 2: ENCLOSED FILES & DELIVERABLES (${totalFiles} Files Total)`, 14, y);
      y += 6;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);

      if (originalMedia) {
        const isRedactedExist = passport.blueprint?.covered_derivatives && passport.blueprint.covered_derivatives.length > 0;
        const roleStr = isRedactedExist ? "Master Original (Concealed for Privacy)" : "Original Master File";
        pdf.text(`[1] ${originalMedia.name} | Role: ${roleStr} | Size: ${(originalMedia.size/1024/1024).toFixed(2)} MB`, 16, y);
        y += 5;
      }

      derivativesList.forEach((d, idx) => {
        const covered = passport.blueprint?.covered_derivatives?.find((cd) => cd.filename === d.name);
        const roleStr = covered ? `Redacted Copy (${covered.reason})` : "Supporting File";
        pdf.text(`[${idx + 2}] ${d.name} | Role: ${roleStr} | Size: ${(d.size/1024/1024).toFixed(2)} MB`, 16, y);
        y += 5;
      });

      y += 4;
      pdf.line(14, y, pageWidth - 14, y);
      y += 8;

      // Section 3: Custody Ledger Table
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.text(`SECTION 3: CHAIN-OF-CUSTODY AUDIT LEDGER (${custodyHistory.length} Handover Entries)`, 14, y);
      y += 6;

      custodyHistory.forEach((rec, idx) => {
        if (y > 270) {
          pdf.addPage();
          y = 15;
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        const nameStr = rec.data?.full_name || "Officer";
        const badgeStr = rec.data?.id_number ? `(${rec.data.id_number})` : "";
        const agencyStr = rec.data?.agency || "";
        const dateStr = rec.timestamp ? new Date(rec.timestamp).toLocaleString() : "";
        
        pdf.text(`Entry #${idx + 1}: ${nameStr} ${badgeStr} - ${agencyStr}`, 16, y);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8);
        pdf.text(dateStr, pageWidth - 14, y, { align: "right" });
        y += 4;

        if (rec.data?.note) {
          pdf.setFont("helvetica", "italic");
          pdf.text(`Action/Note: "${rec.data.note}"`, 20, y);
          y += 4;
        }

        pdf.setFont("courier", "normal");
        pdf.setFontSize(7.5);
        pdf.text(`ECDSA Stamp: ${rec.signature ? rec.signature.slice(0, 48) + "…" : "Verified"}`, 20, y);
        y += 6;
      });

      y += 4;
      if (y > 260) {
        pdf.addPage();
        y = 15;
      }
      pdf.line(14, y, pageWidth - 14, y);
      y += 6;

      // Section 4: Standards Attestation
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.text("CRYPTOGRAPHIC STANDARDS COMPLIANCE ATTESTATION", 14, y);
      y += 5;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.text("Hashing: SHA-256 (FIPS 180-4)  |  Signatures: ECDSA P-256 (FIPS 186-4)  |  Canonicalization: RFC 8785 (JCS)", 14, y);
      y += 8;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(100, 100, 100);
      pdf.text("ProofIt Evidence Preservation Platform • ISO/IEC & FIPS Compliant • Self-Authenticating Digital Ledger", 14, y);

      const safeCase = caseRefStr.replace(/[^a-zA-Z0-9_-]/g, "_");
      pdf.save(`EVIDENTIARY_CERTIFICATE_${safeCase}.pdf`);
    } catch (err) {
      console.error("PDF generation error:", err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Listen for PWA OS File Launch events (.proof double-click or Open With)
  React.useEffect(() => {
    if (typeof window !== "undefined" && "launchQueue" in window) {
      try {
        (window as any).launchQueue.setConsumer(async (launchParams: any) => {
          if (launchParams && launchParams.files && launchParams.files.length > 0) {
            const fileHandle = launchParams.files[0];
            const file = await fileHandle.getFile();
            if (file) {
              setProofFile(file);
              processVerification(file);
            }
          }
        });
      } catch (err) {
        console.warn("PWA LaunchQueue notice:", err);
      }
    }
  }, []);

  const processVerification = async (fileToProcess?: File) => {
    const targetFile = fileToProcess || proofFile;
    if (!targetFile) return;

    // Reset all previous state before verifying new file
    setProofFile(targetFile);
    setStatus("verifying");
    setProgress(0);
    setResult(null);
    setPassport(null);
    setOriginalMedia(null);
    setDerivativesList([]);
    setFinalPayload(null);
    if (mediaPreviewUrl) {
      URL.revokeObjectURL(mediaPreviewUrl);
      setMediaPreviewUrl(null);
    }

    try {
      const { passport: p, mediaFile: m, derivatives: d } = await unpackProof(targetFile);
      setPassport(p);
      setOriginalMedia(m);
      setDerivativesList(d);

      let activeFinalFile: File = m;
      let derivativeFlag = false;

      if (d.length > 0) {
        activeFinalFile = d[d.length - 1];
        derivativeFlag = true;
      }

      setFinalPayload(activeFinalFile);
      setIsDerivative(derivativeFlag);

      try {
        const previewUrl = URL.createObjectURL(activeFinalFile);
        setMediaPreviewUrl(previewUrl);
      } catch (_) {}

      const verificationResult = await verifyProof(p, m, setProgress);
      verificationResult.isValid = verificationResult.overall;

      if (!p.evidenceMetadata) {
        p.evidenceMetadata = {
          evidenceId: p.case_id,
          caseId: p.case_id,
          originalFileName: m.name,
          fileType: m.type,
          fileSizeBytes: m.size,
          merkleRootHex: p.blueprint?.root_fingerprint || "",
          sealedAtTimestamp: p.history[0]?.timestamp,
          sealedByOfficerBadge: p.history[0]?.data?.id_number,
        };
      }

      setResult(verificationResult);
      setStatus("done");
      if (onVerified) onVerified(p, verificationResult);
    } catch (err) {
      setResult({
        pass1: false,
        pass2: false,
        overall: false,
        details: [{
          pass: false,
          label: "Container Integrity Error",
          message: err instanceof Error ? err.message : "Failed to process .proof container structure",
        }],
      });
      setStatus("done");
    }
  };

  const handleFileChange = (file: File) => {
    setProofFile(file);
    processVerification(file);
  };

  const handleResetVerification = () => {
    setProofFile(null);
    setPassport(null);
    setOriginalMedia(null);
    setDerivativesList([]);
    setFinalPayload(null);
    setResult(null);
    setStatus("idle");
    if (mediaPreviewUrl) {
      URL.revokeObjectURL(mediaPreviewUrl);
      setMediaPreviewUrl(null);
    }
  };

  const custodyHistory: CustodyRecord[] = passport?.history || [];

  return (
    <>
      {/* ── INTERACTIVE WEB DASHBOARD (HIDDEN ON PRINT) ── */}
      <div className="bg-[#f9f9fa] text-[#1a1c1d] font-sans space-y-6 print:hidden">

        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-neutral-200 pb-5">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-neutral-200 text-neutral-800 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
              <span>No Login Required</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black">
              Proof Verification
            </h1>
            <p className="text-xs text-neutral-500">
              Confirm whether an evidence file is original or has been modified.
            </p>
          </div>

          {status === "done" && (
            <button
              onClick={handleResetVerification}
              className="px-4 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <FolderOpen className="w-4 h-4 text-white" />
              <span>Verify Another .proof File</span>
            </button>
          )}
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleFileChange(e.dataTransfer.files[0]);
            }
          }}
          onClick={() => proofRef.current?.click()}
          className="relative group cursor-pointer bg-white hover:bg-neutral-50 transition-all duration-200 rounded-3xl p-8 sm:p-12 text-center shadow-xs border border-[#e4e4e7] hover:border-black"
        >
          <input
            ref={proofRef}
            type="file"
            accept=".proof"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
          />
          {status === "verifying" ? (
            <div className="flex flex-col items-center justify-center space-y-3 py-4">
              <Loader2 className="w-10 h-10 text-black animate-spin" />
              <p className="text-sm font-bold text-black">Unpacking & Verifying Container Integrity…</p>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-black group-hover:scale-105 transition-transform duration-200">
                <FolderOpen className="w-8 h-8 text-black" />
              </div>
              <div>
                <p className="text-lg font-bold text-black">
                  Drop the .proof file here or click to browse
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  Standard institutional container format (.proof)
                </p>
              </div>
              {proofFile && (
                <div className={`inline-flex items-center gap-2 border px-4 py-2 rounded-full text-xs font-bold ${
                  result && !result.overall
                    ? "bg-rose-50 border-rose-300 text-rose-800"
                    : "bg-emerald-50 border-emerald-300 text-emerald-800"
                }`}>
                  {result && !result.overall ? (
                    <XCircle className="w-4 h-4 text-rose-600" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>Loaded File: {proofFile.name} ({(proofFile.size / 1024 / 1024).toFixed(2)} MB)</span>
                </div>
              )}
            </div>
          )}
        </div>

        {status === "done" && result && (
          <div className="space-y-6">

            <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#e4e4e7] space-y-5">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs ${
                    result.overall ? "bg-emerald-600" : "bg-rose-600"
                  }`}>
                    {result.overall ? <CheckCircle2 className="w-7 h-7" /> : <XCircle className="w-7 h-7" />}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-black">
                      {result.overall
                        ? isDerivative
                          ? "Privacy Redacted File Active — Original Record Secure"
                          : "Original File Untouched — Integrity Certified"
                        : "Container Integrity Issue Detected"}
                    </h2>
                    <p className="text-xs text-neutral-500 mt-0.5">
                      {result.overall
                        ? "Digital stamps and fingerprint hashes verified 100% authentic across the chain of custody."
                        : "Warning: Container data, hash fingerprint, or signature continuity check failed."}
                    </p>
                  </div>
                </div>

                <div className={`flex items-center gap-2 self-start lg:self-center px-3.5 py-1.5 rounded-xl border text-xs ${
                  result.overall
                    ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                    : "bg-rose-50 border-rose-200 text-rose-900"
                }`}>
                  <ShieldCheck className={`w-4 h-4 ${result.overall ? "text-emerald-700" : "text-rose-700"}`} />
                  <span className="font-bold">{result.overall ? "Tamper Proof Secured" : "Tamper Alert Triggered"}</span>
                </div>
              </div>

              {passport ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-[#f9f9fa] rounded-xl p-4 border border-neutral-200 text-xs">
                  <div>
                    <span className="text-neutral-500 block uppercase text-[10px] tracking-wider font-mono">Case Number</span>
                    <span className="font-bold text-black text-sm mt-0.5 block">{passport.case_id || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block uppercase text-[10px] tracking-wider font-mono">Sealing Date</span>
                    <span className="font-bold text-black text-sm mt-0.5 block">
                      {passport.evidenceMetadata?.sealedAtTimestamp
                        ? new Date(passport.evidenceMetadata.sealedAtTimestamp).toLocaleDateString()
                        : "N/A"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block uppercase text-[10px] tracking-wider font-mono">Verified Handlers</span>
                    <span className="font-bold text-black text-sm mt-0.5 block">{custodyHistory.length} Officers & Specialists</span>
                  </div>
                  <div>
                    <span className="text-neutral-500 block uppercase text-[10px] tracking-wider font-mono">Integrity Check</span>
                    {result.overall ? (
                      <span className="font-bold text-emerald-700 text-sm mt-0.5 block flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Passed All Checks
                      </span>
                    ) : (
                      <span className="font-bold text-rose-700 text-sm mt-0.5 block flex items-center gap-1">
                        <XCircle className="w-4 h-4 text-rose-600" />
                        Verification Failed
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs text-rose-900 space-y-1">
                  <div className="font-bold text-sm text-rose-950 flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    <span>Corrupted or Manipulated Container Structure</span>
                  </div>
                  <p className="text-rose-700">
                    The loaded .proof file does not contain a valid evidence record or media content.
                  </p>
                </div>
              )}

              {/* Detailed Verification Audit Breakdown Log */}
              <div className="space-y-3 pt-2 border-t border-neutral-100">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-black" />
                    Automated Verification Audit Breakdown ({result.details.length} Tests)
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${result.overall ? "bg-emerald-100 text-emerald-900" : "bg-rose-100 text-rose-900"}`}>
                    {result.overall ? "100% VERIFIED" : "VERIFICATION FAILED"}
                  </span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {result.details.map((detail, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                        detail.pass
                          ? "bg-emerald-50/50 border-emerald-200 text-emerald-950"
                          : "bg-rose-50 border-rose-200 text-rose-950 font-medium"
                      }`}
                    >
                      {detail.pass ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      )}
                      <div className="space-y-0.5 break-all">
                        <div className="font-bold flex items-center justify-between gap-2">
                          <span>{detail.label}</span>
                          <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded uppercase ${
                            detail.pass ? "bg-emerald-200 text-emerald-900" : "bg-rose-200 text-rose-900"
                          }`}>
                            {detail.pass ? "PASS" : "FAIL"}
                          </span>
                        </div>
                        <p className="text-[11px] leading-relaxed opacity-90">{detail.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {passport && (
                <div className="space-y-2 pt-2 border-t border-neutral-100">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-black" />
                    Evidence Item Details
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-[#f9f9fa] rounded-xl p-4 border border-neutral-200 text-xs">
                    <div>
                      <span className="text-neutral-500 block uppercase text-[10px] tracking-wider font-mono">Original File Name</span>
                      <span className="font-bold text-black break-all text-xs mt-0.5 block">
                        {passport.evidenceMetadata?.originalFileName || passport.blueprint?.original_filename || originalMedia?.name || "Evidence_Payload"}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block uppercase text-[10px] tracking-wider font-mono">File Type & Size</span>
                      <span className="font-bold text-black text-xs mt-0.5 block">
                        {originalMedia?.type || passport.evidenceMetadata?.fileType || "application/octet-stream"} ({( (originalMedia?.size || passport.evidenceMetadata?.fileSizeBytes || 0) / 1024).toFixed(1)} KB)
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block uppercase text-[10px] tracking-wider font-mono">Sealing Officer</span>
                      <span className="font-bold text-black text-xs mt-0.5 block">
                        {custodyHistory[0]?.data?.full_name || custodyHistory[0]?.actorName || passport.evidenceMetadata?.sealedByOfficerBadge || "Unspecified"}
                      </span>
                    </div>
                    <div>
                      <span className="text-neutral-500 block uppercase text-[10px] tracking-wider font-mono">Digital Seal Fingerprint</span>
                      <span className="font-mono font-bold text-black break-all text-[11px] mt-0.5 block">
                        {passport.blueprint?.root_fingerprint ? `${passport.blueprint.root_fingerprint.slice(0, 18)}…` : "N/A"}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {passport && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

                  <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#e4e4e7] space-y-4">
                      <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
                        <div>
                          <h3 className="text-base font-bold text-black">Evidence Item Preview</h3>
                          <p className="text-xs text-neutral-500 mt-0.5">
                            {isDerivative
                              ? "Public Redacted Payload (Original concealed to protect privacy)"
                              : "Direct stream from sealed container file payload"}
                          </p>
                        </div>
                        {isDerivative && (
                          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px]">
                            Privacy Redacted
                          </span>
                        )}
                      </div>

                      {finalPayload && mediaPreviewUrl && (
                        <div className="bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 p-4 text-center">
                          {finalPayload.type.startsWith("image/") ? (
                            <img
                              src={mediaPreviewUrl}
                              alt="Evidence payload preview"
                              className="max-h-96 mx-auto rounded-lg object-contain shadow-md"
                            />
                          ) : finalPayload.type.startsWith("video/") ? (
                            <video
                              src={mediaPreviewUrl}
                              controls
                              className="max-h-96 w-full mx-auto rounded-lg shadow-md"
                            />
                          ) : (
                            <div className="py-8 space-y-3">
                              <FileText className="w-12 h-12 text-white mx-auto" />
                              <p className="text-sm font-bold text-white">{finalPayload.name}</p>
                              <p className="text-xs text-neutral-400">Document / Data File • {(finalPayload.size / 1024).toFixed(1)} KB</p>
                            </div>
                          )}
                        </div>
                      )}

                      {finalPayload && (
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                          <div>
                            <h4 className="font-bold text-sm text-black">{finalPayload.name}</h4>
                            <p className="text-xs text-neutral-500">
                              {(finalPayload.size / 1024 / 1024).toFixed(2)} MB • {finalPayload.type || "Document / Data File"}
                            </p>
                          </div>
                          <button
                            onClick={() => triggerFileDownload(finalPayload)}
                            className="px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                          >
                            <Download className="w-4 h-4 text-white" />
                            <span>Download File</span>
                          </button>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-neutral-100 space-y-3">
                        <h4 className="text-xs font-bold text-black">Included Files ({1 + derivativesList.length})</h4>

                        {originalMedia && (() => {
                          const isMasterCovered = Boolean(
                            passport.blueprint?.covered_derivatives && passport.blueprint.covered_derivatives.length > 0
                          );

                          if (isMasterCovered) return null;

                          return (
                            <div className="p-3 bg-[#f9f9fa] rounded-xl border border-neutral-200 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2.5 truncate">
                                <FileText className="w-4 h-4 text-neutral-600 flex-shrink-0" />
                                <div className="truncate">
                                  <span className="font-semibold text-black truncate block">{originalMedia.name}</span>
                                </div>
                                <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded font-bold">Original File</span>
                              </div>
                              <button
                                onClick={() => triggerFileDownload(originalMedia)}
                                className="text-xs font-semibold text-neutral-700 hover:text-black flex items-center gap-1 flex-shrink-0 cursor-pointer"
                              >
                                <span>Download</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })()}

                        {derivativesList.map((d, i) => {
                          const coveredEntry = passport.blueprint?.covered_derivatives?.find(
                            (cd) => cd.filename === d.name
                          );
                          const isRedactedCopy = Boolean(coveredEntry);

                          return (
                            <div key={i} className="p-3 bg-[#f9f9fa] rounded-xl border border-neutral-200 flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2.5 truncate min-w-0">
                                <FileText className="w-4 h-4 text-neutral-600 flex-shrink-0" />
                                <div className="truncate min-w-0">
                                  <span className="font-semibold text-black truncate block">{d.name}</span>
                                  {coveredEntry?.reason && (
                                    <span className="text-[11px] text-neutral-500 block truncate mt-0.5">
                                      Description: {coveredEntry.reason}
                                    </span>
                                  )}
                                </div>
                                {isRedactedCopy ? (
                                  <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold flex-shrink-0">
                                    Redacted
                                  </span>
                                ) : (
                                  <span className="text-[10px] bg-neutral-200 text-neutral-800 px-2 py-0.5 rounded font-bold flex-shrink-0">
                                    Supporting Document
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => triggerFileDownload(d)}
                                className="text-xs font-semibold text-neutral-700 hover:text-black flex items-center gap-1 flex-shrink-0 cursor-pointer"
                              >
                                <span>Download</span>
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>

                      {passport.blueprint?.covered_derivatives && passport.blueprint.covered_derivatives.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-neutral-100 space-y-2">
                          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                            <EyeOff className="w-4 h-4 text-amber-700" />
                            <span>Privacy Redacted Copies Details ({passport.blueprint.covered_derivatives.length})</span>
                          </div>
                          {passport.blueprint.covered_derivatives.map((d, i) => (
                            <div key={i} className="p-3 bg-amber-50/60 rounded-xl border border-amber-200 text-xs space-y-1">
                              <div><span className="text-neutral-500">Redacted File:</span> <strong className="text-black">{d.filename}</strong></div>
                              <div><span className="text-neutral-500">Redaction Note:</span> <span className="text-neutral-800 italic">&ldquo;{d.reason}&rdquo;</span></div>
                              <div><span className="text-neutral-500">Applied Date:</span> <span className="text-neutral-600 font-mono text-[11px]">{new Date(d.linked_at).toLocaleString()}</span></div>
                            </div>
                          ))}
                        </div>
                      )}

                    </div>
                  </div>

                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#e4e4e7] space-y-4">
                      <div>
                        <h3 className="text-base font-bold text-black">Complete Handover Record</h3>
                        <p className="text-xs text-neutral-500 mt-0.5">Transparent audit timeline of officer handovers & notes.</p>
                      </div>

                      <div className="relative flex flex-col gap-4 mt-2 pl-2 max-h-[380px] overflow-y-auto pr-1">
                        <div className="absolute left-4 top-3 bottom-5 w-0.5 bg-neutral-200"></div>

                        {custodyHistory.map((rec, idx) => {
                          const name = rec.data?.full_name || "Officer";
                          const badgeId = rec.data?.id_number || "";
                          const agency = rec.data?.agency || "Law Enforcement Agency";
                          const note = rec.data?.note || "";

                          return (
                            <div key={idx} className="relative flex items-start gap-3">
                              <div className="w-7 h-7 rounded-full bg-black text-white flex items-center justify-center shrink-0 z-10 font-bold text-xs shadow-xs">
                                <Check className="w-3.5 h-3.5 text-white" />
                              </div>
                              <div className="flex flex-col flex-1 bg-[#f9f9fa] p-3.5 rounded-xl border border-neutral-200 text-xs space-y-1">
                                <div className="flex justify-between items-center">
                                  <h4 className="font-bold text-black">{name}</h4>
                                  {badgeId && <span className="text-[10px] font-mono text-neutral-400">{badgeId}</span>}
                                </div>
                                <p className="text-neutral-500 text-[11px]">{agency}</p>
                                {note && (
                                  <div className="text-xs text-neutral-800 bg-white p-2.5 rounded-lg border border-neutral-200 mt-1 leading-relaxed">
                                    <span className="font-semibold text-black block mb-0.5">Note / Action:</span>
                                    &ldquo;{note}&rdquo;
                                  </div>
                                )}
                                <span className="text-[10px] text-neutral-400 self-end font-mono mt-1">
                                  {rec.timestamp ? new Date(rec.timestamp).toLocaleString() : ""}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                </div>

                <div className={`rounded-2xl p-5 text-center space-y-2 border ${
                  result?.overall ? "bg-white border-[#e4e4e7]" : "bg-rose-50/50 border-rose-200"
                }`}>
                  <div className={`w-10 h-10 rounded-full text-white flex items-center justify-center mx-auto shadow-xs ${
                    result?.overall ? "bg-emerald-600" : "bg-rose-600"
                  }`}>
                    {result?.overall ? <ShieldCheck className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                  </div>
                  <h4 className="font-bold text-black text-xs uppercase tracking-wider font-mono">
                    {result?.overall ? "Verification Seal" : "Tamper Verification Warning"}
                  </h4>
                  <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-neutral-700 max-w-2xl mx-auto pt-1 font-sans">
                    <div><span className="text-neutral-500">Case Ref:</span> <strong className="text-black">{passport.case_id}</strong></div>
                    <div>
                      <span className="text-neutral-500">Status:</span>{" "}
                      <strong className={result?.overall ? "text-emerald-700 font-bold" : "text-rose-700 font-bold"}>
                        {result?.overall ? "Verified Authentic" : "VERIFICATION FAILED (Tampered)"}
                      </strong>
                    </div>
                    <div><span className="text-neutral-500">Seal Reference:</span> <span className="font-mono text-xs text-black font-semibold">#{passport.blueprint?.root_fingerprint ? passport.blueprint.root_fingerprint.slice(0, 12) : "N/A"}</span></div>
                    <div><span className="text-neutral-500">Sealed By:</span> <strong className="text-black">{custodyHistory[0]?.data?.full_name || custodyHistory[0]?.actorName || "Authorized Officer"}</strong></div>
                  </div>
                </div>
              </>
            )}

            {/* Bottom Action Bar */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#e4e4e7] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-neutral-100 flex items-center justify-center text-black border border-neutral-200">
                  <ShieldCheck className="w-5 h-5 text-black" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-black">Verification Complete</h4>
                  <p className="text-xs text-neutral-500">Preview official certificate or export institutional PDF report.</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                <button
                  onClick={handleResetVerification}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black font-semibold text-xs transition-all flex items-center justify-center gap-1.5 border border-neutral-300 cursor-pointer"
                >
                  <FolderOpen className="w-4 h-4 text-black" />
                  <span>Verify Another File</span>
                </button>

                <button
                  onClick={() => setShowCertModal(true)}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black font-semibold text-xs transition-all flex items-center justify-center gap-1.5 border border-neutral-300 cursor-pointer"
                >
                  <FileText className="w-4 h-4 text-black" />
                  <span>Preview Certificate</span>
                </button>

                <button
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 className="w-4 h-4 text-white animate-spin" />
                      <span>Generating PDF…</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4 text-white" />
                      <span>Download PDF Report</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => window.print()}
                  className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-black font-bold text-xs transition-all flex items-center justify-center gap-1.5 border border-neutral-300 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Report</span>
                </button>
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ── ON-SCREEN CERTIFICATE PREVIEW MODAL ── */}
      {showCertModal && passport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs font-sans print:hidden">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-neutral-300 overflow-hidden">
            <div className="p-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-black" />
                <h3 className="font-bold text-sm text-black">Official Evidentiary Certificate Preview</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadPdf}
                  disabled={isExportingPdf}
                  className="px-3.5 py-1.5 rounded-lg bg-black hover:bg-neutral-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isExportingPdf ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                      <span>Generating…</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download PDF</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-black text-xs font-semibold flex items-center gap-1.5 cursor-pointer border border-neutral-300"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print</span>
                </button>
                <button
                  onClick={() => setShowCertModal(false)}
                  className="p-1.5 rounded-lg hover:bg-neutral-200 text-neutral-700 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-8 overflow-y-auto space-y-6 text-black bg-white">
              {/* Header */}
              <div className="border-b-2 border-black pb-4 flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {result?.overall ? (
                      <ShieldCheck className="w-8 h-8 text-[#047857]" />
                    ) : (
                      <XCircle className="w-8 h-8 text-[#b91c1c]" />
                    )}
                    <div>
                      <h1 className="text-xl font-bold uppercase tracking-wider font-mono text-black leading-none">
                        OFFICIAL EVIDENTIARY CERTIFICATE
                      </h1>
                      <p className="text-xs font-mono text-neutral-600 mt-1">
                        Institutional Digital Evidence Chain-of-Custody Certificate
                      </p>
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono text-xs space-y-0.5">
                  <div><span className="text-neutral-500">Case Ref:</span> <strong>{passport.case_id}</strong></div>
                  <div><span className="text-neutral-500">Issued:</span> {new Date().toLocaleDateString()}</div>
                  <div>
                    <span className="text-neutral-500">Status:</span>{" "}
                    <strong className={result?.overall ? "text-[#047857]" : "text-[#b91c1c]"}>
                      {result?.overall ? "VERIFIED AUTHENTIC" : "TAMPERED / FAILED"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Exhibit Specs Table */}
              <div className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-black border-b border-black pb-1">
                  Section 1: Primary Evidence Exhibit Specifications
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-neutral-50 p-4 rounded-lg border border-neutral-200">
                  <div>
                    <span className="text-neutral-500 block uppercase text-[10px]">Case Reference</span>
                    <strong className="text-black">{passport.case_id}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block uppercase text-[10px]">Initial Sealing Date</span>
                    <strong className="text-black">
                      {passport.evidenceMetadata?.sealedAtTimestamp ? new Date(passport.evidenceMetadata.sealedAtTimestamp).toLocaleDateString() : "N/A"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block uppercase text-[10px]">Primary File Name</span>
                    <strong className="text-black truncate block">{passport.evidenceMetadata?.originalFileName || originalMedia?.name || passport.blueprint?.original_filename || "N/A"}</strong>
                  </div>
                  <div>
                    <span className="text-neutral-500 block uppercase text-[10px]">Primary File Size</span>
                    <strong className="text-black">{( (originalMedia?.size || passport.evidenceMetadata?.fileSizeBytes || 0) / 1024 / 1024 ).toFixed(2)} MB</strong>
                  </div>
                </div>
                <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200 font-mono text-xs">
                  <span className="text-neutral-500 block text-[10px] uppercase font-sans">Merkle Root Fingerprint (SHA-256)</span>
                  <span className="font-bold text-black break-all text-[11px]">{passport.blueprint?.root_fingerprint}</span>
                </div>
              </div>

              {/* Section 2: Enclosed Files List */}
              <div className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-black border-b border-black pb-1">
                  Section 2: Enclosed Files & Deliverables ({1 + derivativesList.length} Files Total)
                </h2>
                <table className="w-full text-xs text-left border-collapse border border-neutral-300">
                  <thead className="bg-neutral-100 font-mono text-[10px] uppercase">
                    <tr>
                      <th className="p-2 border-r border-b border-neutral-300">Filename</th>
                      <th className="p-2 border-r border-b border-neutral-300">Classification</th>
                      <th className="p-2 border-r border-b border-neutral-300">File Size</th>
                      <th className="p-2 border-b border-neutral-300">Description / Redaction Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Master Original File */}
                    {originalMedia && (
                      <tr className="border-b border-neutral-200 text-[11px]">
                        <td className="p-2 border-r border-neutral-200 font-bold">{originalMedia.name}</td>
                        <td className="p-2 border-r border-neutral-200 font-mono">
                          {passport.blueprint?.covered_derivatives && passport.blueprint.covered_derivatives.length > 0 ? (
                            <span className="text-amber-800 font-bold">Master Original (Concealed)</span>
                          ) : (
                            <span className="text-black font-bold">Original Master File</span>
                          )}
                        </td>
                        <td className="p-2 border-r border-neutral-200 font-mono">{(originalMedia.size / 1024 / 1024).toFixed(2)} MB</td>
                        <td className="p-2 text-neutral-600">
                          {passport.blueprint?.covered_derivatives && passport.blueprint.covered_derivatives.length > 0
                            ? "Raw master evidence file — concealed from public view to protect privacy"
                            : "Primary untouched evidence payload"}
                        </td>
                      </tr>
                    )}
                    {/* Derivative & Supporting Files */}
                    {derivativesList.map((d, i) => {
                      const coveredEntry = passport.blueprint?.covered_derivatives?.find(
                        (cd) => cd.filename === d.name
                      );
                      return (
                        <tr key={i} className="border-b border-neutral-200 text-[11px]">
                          <td className="p-2 border-r border-neutral-200 font-bold">{d.name}</td>
                          <td className="p-2 border-r border-neutral-200 font-mono">
                            {coveredEntry ? (
                              <span className="text-amber-700 font-bold">Redacted Copy</span>
                            ) : (
                              <span className="text-neutral-700 font-semibold">Supporting File</span>
                            )}
                          </td>
                          <td className="p-2 border-r border-neutral-200 font-mono">{(d.size / 1024 / 1024).toFixed(2)} MB</td>
                          <td className="p-2 italic">{coveredEntry?.reason || "Supporting evidence item"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Handover Table */}
              <div className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-black border-b border-black pb-1">
                  Section 3: Chain-of-Custody Audit Ledger ({custodyHistory.length} Handover Entries)
                </h2>
                <table className="w-full text-xs text-left border-collapse border border-neutral-300">
                  <thead className="bg-black text-white font-mono text-[10px] uppercase">
                    <tr>
                      <th className="p-2 border-r border-neutral-800">#</th>
                      <th className="p-2 border-r border-neutral-800">Handler Name</th>
                      <th className="p-2 border-r border-neutral-800">Badge ID</th>
                      <th className="p-2 border-r border-neutral-800">Agency / Department</th>
                      <th className="p-2 border-r border-neutral-800">Action & Note</th>
                      <th className="p-2">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {custodyHistory.map((rec, idx) => (
                      <tr key={idx} className="border-b border-neutral-200 text-[11px]">
                        <td className="p-2 border-r border-neutral-200 font-mono font-bold">{idx + 1}</td>
                        <td className="p-2 border-r border-neutral-200 font-bold">{rec.data?.full_name || "Officer"}</td>
                        <td className="p-2 border-r border-neutral-200 font-mono">{rec.data?.id_number || "N/A"}</td>
                        <td className="p-2 border-r border-neutral-200">{rec.data?.agency || "N/A"}</td>
                        <td className="p-2 border-r border-neutral-200 italic">&ldquo;{rec.data?.note || "Handover recorded"}&rdquo;</td>
                        <td className="p-2 font-mono text-[10px]">{rec.timestamp ? new Date(rec.timestamp).toLocaleString() : "N/A"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── PRINT & PDF EXPORT FORMAL EVIDENTIARY CERTIFICATE ── */}
      {passport && (
        <div ref={printCertRef} className="hidden print:block w-full text-black font-sans bg-white p-2">
          
          {/* Official Letterhead Header */}
          <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-3 text-black">
                <ShieldCheck className="w-10 h-10 text-black" />
                <div>
                  <h1 className="text-xl font-bold uppercase tracking-wider font-mono text-black leading-none">
                    OFFICIAL EVIDENTIARY CERTIFICATE
                  </h1>
                  <p className="text-xs font-mono text-neutral-700 tracking-tight mt-1">
                    Institutional Digital Evidence Chain-of-Custody Certificate
                  </p>
                </div>
              </div>
            </div>

            <div className="text-right font-mono text-xs space-y-0.5">
              <div><span className="text-neutral-500">Cert Serial:</span> <strong>CERT-EVD-{(passport.case_id || "CASE").toUpperCase()}</strong></div>
              <div><span className="text-neutral-500">Date Issued:</span> {new Date().toLocaleDateString()}</div>
              <div><span className="text-neutral-500">Status:</span> <strong className={result?.overall ? "text-emerald-900" : "text-rose-900"}>{result?.overall ? "VERIFIED AUTHENTIC" : "TAMPERED / FAILED"}</strong></div>
            </div>
          </div>

          {/* Section 1: Primary Evidence Exhibit Specifications */}
          <div className="mb-6 space-y-2 print-avoid-break">
            <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-black border-b border-black pb-1">
              Section 1: Primary Evidence Exhibit Specifications
            </h2>
            <table className="w-full text-xs text-left border-collapse border border-neutral-300">
              <tbody>
                <tr className="border-b border-neutral-200">
                  <td className="p-2 font-semibold text-neutral-600 bg-neutral-50 w-1/4">Case Reference Number:</td>
                  <td className="p-2 font-bold text-black w-1/4">{passport.case_id}</td>
                  <td className="p-2 font-semibold text-neutral-600 bg-neutral-50 w-1/4">Initial Sealing Date:</td>
                  <td className="p-2 font-bold text-black w-1/4">
                    {passport.evidenceMetadata?.sealedAtTimestamp ? new Date(passport.evidenceMetadata.sealedAtTimestamp).toLocaleString() : "N/A"}
                  </td>
                </tr>
                <tr className="border-b border-neutral-200">
                  <td className="p-2 font-semibold text-neutral-600 bg-neutral-50">Original File Name:</td>
                  <td className="p-2 font-bold text-black">{passport.evidenceMetadata?.originalFileName || originalMedia?.name || passport.blueprint?.original_filename || "N/A"}</td>
                  <td className="p-2 font-semibold text-neutral-600 bg-neutral-50">Primary File Size:</td>
                  <td className="p-2 font-bold text-black">
                    {( (originalMedia?.size || passport.evidenceMetadata?.fileSizeBytes || passport.blueprint?.total_file_size || 0) / 1024 / 1024 ).toFixed(2)} MB ({(originalMedia?.size || passport.evidenceMetadata?.fileSizeBytes || passport.blueprint?.total_file_size)} bytes)
                  </td>
                </tr>
                <tr className="border-b border-neutral-200">
                  <td className="p-2 font-semibold text-neutral-600 bg-neutral-50">Sealing Officer:</td>
                  <td className="p-2 font-bold text-black">{custodyHistory[0]?.data?.full_name || custodyHistory[0]?.actorName || "Authorized Officer"}</td>
                  <td className="p-2 font-semibold text-neutral-600 bg-neutral-50">Officer Badge / ID:</td>
                  <td className="p-2 font-bold text-black font-mono">{custodyHistory[0]?.data?.id_number || custodyHistory[0]?.actorBadgeId || "N/A"}</td>
                </tr>
                <tr>
                  <td className="p-2 font-semibold text-neutral-600 bg-neutral-50">Merkle Root Fingerprint:</td>
                  <td colSpan={3} className="p-2 font-mono font-bold text-black text-[11px] break-all">
                    {passport.blueprint?.root_fingerprint}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Section 2: Enclosed Files & Deliverables List (All Master, Redacted, & Supporting Files) */}
          <div className="mb-6 space-y-2 print-avoid-break">
            <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-black border-b border-black pb-1">
              Section 2: Enclosed Files & Deliverables ({1 + derivativesList.length} Files Enclosed)
            </h2>
            <table className="w-full text-xs text-left border-collapse border border-neutral-300">
              <thead className="bg-neutral-100 font-mono text-[10px] uppercase">
                <tr>
                  <th className="p-1.5 border-b border-r border-neutral-300">Filename</th>
                  <th className="p-1.5 border-b border-r border-neutral-300">Classification</th>
                  <th className="p-1.5 border-b border-r border-neutral-300">File Size</th>
                  <th className="p-1.5 border-b border-neutral-300">Description / Redaction Note</th>
                </tr>
              </thead>
              <tbody>
                {/* Master Original File */}
                {originalMedia && (
                  <tr className="border-b border-neutral-200 text-[11px]">
                    <td className="p-1.5 border-r border-neutral-200 font-bold text-black">{originalMedia.name}</td>
                    <td className="p-1.5 border-r border-neutral-200 font-mono">
                      {passport.blueprint?.covered_derivatives && passport.blueprint.covered_derivatives.length > 0 ? (
                        <span className="text-amber-900 font-bold">Master Original (Concealed)</span>
                      ) : (
                        <span className="text-black font-bold">Original Master File</span>
                      )}
                    </td>
                    <td className="p-1.5 border-r border-neutral-200 font-mono">{(originalMedia.size / 1024 / 1024).toFixed(2)} MB</td>
                    <td className="p-1.5 text-neutral-600">
                      {passport.blueprint?.covered_derivatives && passport.blueprint.covered_derivatives.length > 0
                        ? "Raw master evidence file — concealed from public view to protect privacy"
                        : "Primary untouched evidence payload"}
                    </td>
                  </tr>
                )}
                {/* Derivative & Supporting Files */}
                {derivativesList.map((d, i) => {
                  const coveredEntry = passport.blueprint?.covered_derivatives?.find(
                    (cd) => cd.filename === d.name
                  );
                  return (
                    <tr key={i} className="border-b border-neutral-200 text-[11px]">
                      <td className="p-1.5 border-r border-neutral-200 font-bold text-black">{d.name}</td>
                      <td className="p-1.5 border-r border-neutral-200 font-mono">
                        {coveredEntry ? (
                          <span className="text-amber-900 font-bold">Redacted Copy</span>
                        ) : (
                          <span className="text-neutral-700 font-semibold">Supporting File</span>
                        )}
                      </td>
                      <td className="p-1.5 border-r border-neutral-200 font-mono">{(d.size / 1024 / 1024).toFixed(2)} MB</td>
                      <td className="p-1.5 italic">{coveredEntry?.reason || "Supporting evidence item"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Section 3: Full Chain-of-Custody Audit Ledger Table */}
          <div className="mb-6 space-y-2 print-avoid-break">
            <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-black border-b border-black pb-1">
              Section 3: Sequential Chain-of-Custody Handover Ledger ({custodyHistory.length} Verified Transfers)
            </h2>
            <table className="w-full text-xs text-left border-collapse border border-black">
              <thead className="bg-black text-white font-mono text-[10px] uppercase">
                <tr>
                  <th className="p-1.5 border-r border-neutral-700 w-8 text-center">#</th>
                  <th className="p-1.5 border-r border-neutral-700">Handler & Rank</th>
                  <th className="p-1.5 border-r border-neutral-700">Badge ID</th>
                  <th className="p-1.5 border-r border-neutral-700">Agency / Department</th>
                  <th className="p-1.5 border-r border-neutral-700">Handover Action & Notes</th>
                  <th className="p-1.5 border-r border-neutral-700">Timestamp</th>
                  <th className="p-1.5">ECDSA Stamp</th>
                </tr>
              </thead>
              <tbody>
                {custodyHistory.map((rec, idx) => (
                  <tr key={idx} className="border-b border-neutral-300 text-[11px] align-top">
                    <td className="p-1.5 border-r border-neutral-300 font-mono font-bold text-center">{idx + 1}</td>
                    <td className="p-1.5 border-r border-neutral-300 font-bold text-black">{rec.data?.full_name || "Officer"}</td>
                    <td className="p-1.5 border-r border-neutral-300 font-mono">{rec.data?.id_number || "N/A"}</td>
                    <td className="p-1.5 border-r border-neutral-300">{rec.data?.agency || "N/A"}</td>
                    <td className="p-1.5 border-r border-neutral-300 italic">&ldquo;{rec.data?.note || "Handover recorded"}&rdquo;</td>
                    <td className="p-1.5 border-r border-neutral-300 font-mono whitespace-nowrap">
                      {rec.timestamp ? new Date(rec.timestamp).toLocaleString() : "N/A"}
                    </td>
                    <td className="p-1.5 font-mono text-[9px] break-all">{rec.signature ? `${rec.signature.slice(0, 16)}…` : "Verified"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Section 4: Cryptographic Standards Attestation */}
          <div className="mb-6 p-3 border border-neutral-300 bg-neutral-50 rounded text-xs space-y-1 print-avoid-break">
            <h3 className="font-bold font-mono text-[11px] uppercase tracking-wider text-black">
              Cryptographic Standards & Provenance Compliance Attestation
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px] text-neutral-700 pt-1 font-mono">
              <div><strong>Hashing:</strong> SHA-256 (FIPS 180-4)</div>
              <div><strong>Signatures:</strong> ECDSA P-256 (FIPS 186-4)</div>
              <div><strong>Canonical:</strong> RFC 8785 (JCS)</div>
              <div><strong>Container:</strong> Store-Mode ZIP (.proof)</div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-3 border-t border-neutral-300 text-center text-[10px] font-mono text-neutral-500 flex justify-between items-center">
            <span>ProofIt Evidence Preservation Platform • ISO/IEC & FIPS Compliant • Self-Authenticating Digital Ledger</span>
            <span>Official Record Copy</span>
          </div>

        </div>
      )}
    </>
  );
}

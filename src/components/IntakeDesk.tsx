"use client";

import React, { useState, useRef } from "react";
import {
  FolderOpen, Package, Download, EyeOff, Paperclip, FileText, Check, ShieldCheck,
  Volume2, Film, Loader2, AlertCircle, FileCheck, ArrowRight, User, X, Upload, Lock, Scissors, Sparkles, XCircle
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useOffline } from "@/contexts/OfflineContext";
import { computeMerkleRoot } from "@/modules/hasher/merkle";
import { createGenesisRecord, appendHandover } from "@/modules/ledger/append";
import { linkDerivative } from "@/modules/ledger/derivative";
import { packProof, downloadProof, generateProofFileName } from "@/modules/container/pack";
import { unpackProof } from "@/modules/container/unpack";
import { verifyProof } from "@/modules/verifier/verify";
import RedactionStudio from "@/components/RedactionStudio";
import { get, set, del } from "idb-keyval";
import { type Passport, type CustodyRecord, type VerificationResult, getMimeTypeFromName } from "@/types";

const CHUNK_SIZE = 2 * 1024 * 1024;

type WorkspaceMode = "open_bag" | "pack_new";

async function hashFileInline(
  file: File,
  onProgress: (pct: number) => void
): Promise<string[]> {
  const leaves: string[] = [];
  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const buf = await file.slice(offset, end).arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buf);
    leaves.push(
      Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("")
    );
    offset = end;
    onProgress(Math.round((offset / file.size) * 100));
  }
  return leaves;
}

export default function IntakeDesk() {
  const { officer, keypair, isUnlocked } = useAuth();
  const { isOnline } = useOffline();

  // Strict Officer Authentication Guard for Evidence Desk
  if (!isUnlocked || !officer || !keypair) {
    return (
      <div className="bg-white border border-[#e4e4e7] rounded-3xl p-8 sm:p-12 text-center max-w-lg mx-auto my-12 shadow-sm space-y-5 font-sans">
        <div className="w-16 h-16 bg-neutral-100 border border-neutral-200 rounded-2xl flex items-center justify-center mx-auto text-black shadow-xs">
          <Lock className="w-8 h-8 text-black" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-black tracking-tight">Officer Sign In Required</h2>
          <p className="text-xs text-neutral-500 mt-1.5 leading-relaxed">
            The Evidence Desk is restricted to authorized law enforcement officers. You must sign in with your officer ID and master passcode to access the workspace and sign custody records.
          </p>
        </div>
        <a
          href="/login"
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-black hover:bg-neutral-800 text-white font-bold text-xs shadow-md transition-all"
        >
          <span>Sign In as Officer</span>
          <ArrowRight className="w-4 h-4" />
        </a>
      </div>
    );
  }

  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("open_bag");

  // Dynamic Active Evidence Bag State
  const [caseId, setCaseId] = useState<string>("");
  const [caseTitle, setCaseTitle] = useState<string>("");
  const [bagFileName, setBagFileName] = useState<string>("");
  const [passport, setPassport] = useState<Passport | null>(null);

  // Dynamic Files in Evidence Bag
  const [primaryMediaFile, setPrimaryMediaFile] = useState<File | null>(null);
  const [derivativesList, setDerivativesList] = useState<File[]>([]);
  const [activePreviewFile, setActivePreviewFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [activeTextContent, setActiveTextContent] = useState<string | null>(null);

  React.useEffect(() => {
    if (!activePreviewFile) {
      setActiveTextContent(null);
      return;
    }
    const mime = getMimeTypeFromName(activePreviewFile.name, activePreviewFile.type);
    if (
      mime.startsWith("text/") ||
      mime.includes("json") ||
      mime.includes("csv") ||
      activePreviewFile.name.endsWith(".txt") ||
      activePreviewFile.name.endsWith(".csv") ||
      activePreviewFile.name.endsWith(".json")
    ) {
      activePreviewFile
        .text()
        .then((txt) => setActiveTextContent(txt))
        .catch(() => setActiveTextContent(null));
    } else {
      setActiveTextContent(null);
    }
  }, [activePreviewFile]);

  // New Pack State (Supports Multiple Files & Officer Sealing Note)
  const [newCaseId, setNewCaseId] = useState("");
  const [newCaseTitle, setNewCaseTitle] = useState("");
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [newSealingNote, setNewSealingNote] = useState("");

  // Cover Private Details Modal State (Multi-Step Redaction with Instructions & Direct Download)
  const [showRedactModal, setShowRedactModal] = useState<boolean>(false);
  const [redactStep, setRedactStep] = useState<1 | 2>(1);
  const [targetCoverFileName, setTargetCoverFileName] = useState<string>("");
  const [redactFile, setRedactFile] = useState<File | null>(null);
  const [redactReason, setRedactReason] = useState<string>("");

  // In-Browser Interactive Redaction Studio Modal State
  const [showStudio, setShowStudio] = useState<boolean>(false);
  const [studioTargetFile, setStudioTargetFile] = useState<File | null>(null);

  // Attach Supporting File Modal State (Supports Multi-File & Dropzone)
  const [showAttachModal, setShowAttachModal] = useState<boolean>(false);
  const [supportingFiles, setSupportingFiles] = useState<File[]>([]);

  // Cryptographic Verification Audit Modal State
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState<boolean>(false);
  const [isVerifyingBag, setIsVerifyingBag] = useState<boolean>(false);

  // Officer Session Note (Starts empty)
  const [officerNote, setOfficerNote] = useState<string>("");

  // Status & Progress
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "processing" | "done" | "error">("idle");
  const [statusMsg, setStatusMsg] = useState("");

  const proofRef = useRef<HTMLInputElement>(null);
  const newFileRef = useRef<HTMLInputElement>(null);
  const redactRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  // Storage key scoped to authenticated officer badgeId to prevent cross-account leak
  const storageKey = officer ? `proofit_active_bag_${officer.badgeId}` : "proofit_active_bag";

  // Reset workspace state whenever officer logs out or changes
  React.useEffect(() => {
    if (!isUnlocked || !officer) {
      setPassport(null);
      setPrimaryMediaFile(null);
      setDerivativesList([]);
      setActivePreviewFile(null);
      setPreviewUrl(null);
      setCaseId("");
      setCaseTitle("");
      setVerificationResult(null);
      setShowVerifyModal(false);
    }
  }, [isUnlocked, officer?.badgeId]);

  // Helper to persist active container to IndexedDB across refreshes
  const saveActiveBagToStorage = async (p: Passport, master: File, derivatives: File[]) => {
    if (!officer) return;
    try {
      const masterBuf = await master.arrayBuffer();
      const derivativeBufs = await Promise.all(
        derivatives.map(async (d) => ({
          name: d.name,
          type: d.type,
          data: await d.arrayBuffer(),
        }))
      );
      await set(storageKey, {
        passport: p,
        masterFile: { name: master.name, type: master.type, data: masterBuf },
        derivatives: derivativeBufs,
      });
    } catch (err) {
      console.warn("Failed to persist active container to IndexedDB:", err);
    }
  };

  // Auto-restore active evidence container from IndexedDB on page refresh for current officer
  React.useEffect(() => {
    const restoreActiveBag = async () => {
      if (!officer) return;
      try {
        const stored = await get<{
          passport: Passport;
          masterFile: { name: string; type: string; data: ArrayBuffer };
          derivatives: Array<{ name: string; type: string; data: ArrayBuffer }>;
        }>(storageKey);

        if (stored && stored.passport && stored.masterFile) {
          const master = new File([stored.masterFile.data], stored.masterFile.name, {
            type: stored.masterFile.type,
          });
          const derivs = (stored.derivatives || []).map(
            (d) => new File([d.data], d.name, { type: d.type })
          );

          setPassport(stored.passport);
          setPrimaryMediaFile(master);
          setDerivativesList(derivs);
          setActivePreviewFile(master);
          setPreviewUrl(URL.createObjectURL(master));
          setCaseId(stored.passport.case_id);
          setCaseTitle(stored.passport.evidenceMetadata?.originalFileName ? `Exhibit: ${stored.passport.evidenceMetadata.originalFileName}` : `Case: ${stored.passport.case_id}`);
          setWorkspaceMode("open_bag");
          setStatus("done");

          // Auto-verify restored bag
          verifyProof(stored.passport, master).then((res) => {
            setVerificationResult(res);
            if (!res.overall) {
              setStatusMsg(`Warning: Active container "${stored.passport.case_id}" loaded — TAMPERING DETECTED.`);
            } else {
              setStatusMsg(`Restored active evidence bag "${stored.passport.case_id}" for Officer ${officer.fullName}.`);
            }
          }).catch(() => {});
        }
      } catch (err) {
        console.warn("Failed to restore active container on refresh:", err);
      }
    };

    restoreActiveBag();
  }, [officer?.badgeId]);

  const handleClearWorkspace = async () => {
    try {
      await del(storageKey);
      await del("proofit_active_bag");
    } catch (e) {}
    setPassport(null);
    setPrimaryMediaFile(null);
    setDerivativesList([]);
    setActivePreviewFile(null);
    setPreviewUrl(null);
    setCaseId("");
    setCaseTitle("");
    setVerificationResult(null);
    setShowVerifyModal(false);
    setWorkspaceMode("open_bag");
    setStatus("idle");
    setStatusMsg("");
  };

  // Run full dual-pass verification audit on the currently open evidence bag
  const handleVerifyOpenBag = async () => {
    if (!passport || !primaryMediaFile) return;
    setIsVerifyingBag(true);
    try {
      const res = await verifyProof(passport, primaryMediaFile, (pct) => setProgress(pct));
      setVerificationResult(res);
      setShowVerifyModal(true);
    } catch (err) {
      console.error("Verification failed:", err);
    } finally {
      setIsVerifyingBag(false);
    }
  };

  // Commit redaction created via native RedactionStudio modal
  const handleCommitStudioRedaction = async (
    redactedFile: File,
    reasonStr: string,
    redactionType: string = "Privacy Redaction",
    tags: string[] = ["PII"],
    similarityPercentage: number = 88.0
  ) => {
    if (!passport || !officer || !keypair || !primaryMediaFile) return;
    setStatus("processing");
    setStatusMsg(`Linking sealed redacted derivative "${redactedFile.name}" & computing Merkle seal...`);
    try {
      const targetName = studioTargetFile ? studioTargetFile.name : primaryMediaFile.name;
      const auditReason = `Covering "${targetName}" with interactive redacted derivative — ${reasonStr}`;

      const updatedPassport = await linkDerivative(
        passport,
        redactedFile,
        auditReason,
        officer,
        keypair.privateKey,
        keypair.publicKey,
        redactionType,
        tags,
        similarityPercentage
      );

      const updatedDerivatives = [...derivativesList, redactedFile];
      setPassport(updatedPassport);
      setDerivativesList(updatedDerivatives);
      setActivePreviewFile(redactedFile);
      setPreviewUrl(URL.createObjectURL(redactedFile));

      await saveActiveBagToStorage(updatedPassport, primaryMediaFile, updatedDerivatives);

      setShowRedactModal(false);
      setShowStudio(false);
      setStudioTargetFile(null);
      setStatus("done");
      setStatusMsg(`Sealed redacted derivative "${redactedFile.name}" attached into evidence bag. (${redactionType}, ${similarityPercentage}% Intact)`);
    } catch (err) {
      setStatus("error");
      setStatusMsg(err instanceof Error ? err.message : "Failed to link redacted derivative.");
    }
  };

  // Trigger file download helper with custody chain logging
  const triggerFileDownload = async (file: File) => {
    if (officer && keypair && passport) {
      try {
        const actionNote = `Downloaded exhibit file: "${file.name}"`;
        const updated = await appendHandover(
          passport,
          officer,
          actionNote,
          keypair.privateKey,
          keypair.publicKey
        );
        setPassport(updated);

        const lastRec = updated.history?.[updated.history.length - 1];
        if (lastRec && isOnline) {
          fetch("/api/custody", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              evidence_id: updated.evidenceId || updated.evidenceMetadata?.evidenceId || `EVD-${caseId}`,
              timestamp: lastRec.timestamp,
              actor_badge_id: officer.badgeId,
              actor_name: officer.fullName,
              action: "File Downloaded",
              notes: actionNote,
              canonical_hash: lastRec.signature || "hash",
              signature: lastRec.signature || "sig",
              public_stamp: officer.publicStamp || "",
            }),
          }).catch(() => {});
        }
      } catch (err) {
        console.error("Failed to append download custody record:", err);
      }
    }

    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Open & Unpack Evidence Container (.proof)
  // Automatically appends a custody handover audit entry for the active logged-in officer!
  const handleOpenProofFile = async (proofBlob: File) => {
    setStatus("processing");
    setStatusMsg("Unpacking & verifying evidence container...");
    setBagFileName(proofBlob.name);
    setVerificationResult(null);

    try {
      const { passport: p, mediaFile: m, derivatives: d } = await unpackProof(proofBlob);
      let currentPassport = p;

      // Automatically record handover/intake entry if officer is logged in and not already recorded as last handler
      if (officer && keypair) {
        const lastRecord = p.history?.[p.history.length - 1];
        const isAlreadyLast = lastRecord?.data?.id_number === officer.badgeId;

        if (!isAlreadyLast) {
          const actionText = `Evidence Bag Intake & Access Audit — Session opened by ${officer.fullName} (${officer.badgeId})`;
          currentPassport = await appendHandover(
            p,
            officer,
            actionText,
            keypair.privateKey,
            keypair.publicKey
          );
        }
      }

      setPassport(currentPassport);
      setPrimaryMediaFile(m);
      setDerivativesList(d);
      setCaseId(currentPassport.case_id || currentPassport.evidenceMetadata?.caseId || "");
      setCaseTitle(currentPassport.blueprint?.original_filename ? `Exhibit: ${currentPassport.blueprint.original_filename}` : "Digital Evidence Bag");

      const active = d.length > 0 ? d[d.length - 1] : m;
      setActivePreviewFile(active);
      setPreviewUrl(URL.createObjectURL(active));

      saveActiveBagToStorage(currentPassport, m, d);

      // Instantly run cryptographic verification on open
      try {
        const vResult = await verifyProof(currentPassport, m);
        setVerificationResult(vResult);
        if (!vResult.overall) {
          setStatusMsg(`Warning: Container "${proofBlob.name}" opened — TAMPERING DETECTED: File content or signature check failed.`);
        } else {
          setStatusMsg(`Evidence container "${proofBlob.name}" unpacked. Access audit entry signed for ${officer.fullName} (${officer.badgeId}).`);
        }
      } catch (e) {
        setVerificationResult({
          pass1: false,
          pass2: false,
          overall: false,
          details: [{
            pass: false,
            label: "Container Integrity Error",
            message: "Container data or manifest structure is corrupt or tampered with.",
          }],
        });
        setStatusMsg(`Warning: Container "${proofBlob.name}" opened — TAMPERING DETECTED: Container structure modified.`);
      }

      setStatus("done");
    } catch (err) {
      setVerificationResult({
        pass1: false,
        pass2: false,
        overall: false,
        details: [{
          pass: false,
          label: "Container Integrity Error",
          message: err instanceof Error ? err.message : "Failed to unpack .proof container structure",
        }],
      });
      setStatus("error");
      setStatusMsg(err instanceof Error ? err.message : "Failed to unpack .proof container");
    }
  };

  // Create & Seal New Evidence Bag (Multiple Files Supported)
  const handleCreateNewBag = async (shouldDownload: boolean = true) => {
    if (newFiles.length === 0 || !newCaseId || !officer || !keypair) return;
    if (!newSealingNote.trim()) {
      setStatus("error");
      setStatusMsg("A note is required before creating the evidence container.");
      return;
    }
    setStatus("processing");
    setProgress(0);

    const masterFile = newFiles[0];
    const extraFiles = newFiles.slice(1);

    try {
      const leaves = await hashFileInline(masterFile, setProgress);
      const root = await computeMerkleRoot(leaves);

      const actionText = `Initial Evidence Intake Sealing (Case: ${newCaseId}) — Note: ${newSealingNote.trim()}`;

      const record = await createGenesisRecord(
        officer,
        actionText,
        keypair.privateKey,
        keypair.publicKey
      );

      const p: Passport = {
        format_version: "1.0",
        case_id: newCaseId,
        blueprint: {
          chunk_size_bytes: CHUNK_SIZE as 2097152,
          total_file_size: masterFile.size,
          chunk_count: leaves.length,
          root_fingerprint: root,
          original_filename: masterFile.name,
          covered_derivatives: [],
        },
        history: [record],
        evidenceId: record.evidenceId || `EVD-${Date.now()}`,
        evidenceMetadata: {
          evidenceId: record.evidenceId || `EVD-${Date.now()}`,
          caseId: newCaseId,
          originalFileName: masterFile.name,
          fileType: masterFile.type || "application/octet-stream",
          fileSizeBytes: masterFile.size,
          merkleRootHex: root,
          totalChunks: leaves.length,
          chunkSizeBytes: CHUNK_SIZE,
          sealedAtTimestamp: record.timestamp,
          sealedByOfficerBadge: officer.badgeId,
          deviceModel: "Air-gapped Workstation",
          osVersion: typeof navigator !== "undefined" ? navigator.platform : "Unknown OS",
          gpsLocation: "Official Secure Station",
        },
        derivatives: [],
      };

      const generatedBagName = generateProofFileName(newCaseId, officer.badgeId);

      setPassport(p);
      setPrimaryMediaFile(masterFile);
      setDerivativesList(extraFiles);
      setActivePreviewFile(masterFile);
      setPreviewUrl(URL.createObjectURL(masterFile));
      setCaseId(newCaseId);
      setCaseTitle(newCaseTitle || `Exhibit: ${masterFile.name}`);
      setBagFileName(generatedBagName);

      saveActiveBagToStorage(p, masterFile, extraFiles);

      if (shouldDownload) {
        const blob = await packProof(p, masterFile, extraFiles);
        downloadProof(blob, generatedBagName);
        setStatusMsg(`Evidence container "${generatedBagName}" created, sealed, and downloaded (${newFiles.length} file${newFiles.length > 1 ? "s" : ""} enclosed).`);
      } else {
        setStatusMsg(`Evidence container "${generatedBagName}" created & sealed to workspace (${newFiles.length} file${newFiles.length > 1 ? "s" : ""} enclosed).`);
      }

      setStatus("done");
      setWorkspaceMode("open_bag");
      setNewFiles([]);
      setNewSealingNote("");
    } catch (err) {
      setStatus("error");
      setStatusMsg(err instanceof Error ? err.message : "Failed to pack new evidence");
    }
  };

  // Cover Private Details (Multi-Step Redaction)
  const handleApplyRedaction = async () => {
    if (!redactFile || !redactReason || !officer || !keypair || !primaryMediaFile) return;
    setStatus("processing");
    setStatusMsg("Applying privacy redaction & updating custody record...");

    try {
      const currentPassport = passport || {
        format_version: "1.0",
        case_id: caseId,
        blueprint: {
          chunk_size_bytes: CHUNK_SIZE as 2097152,
          total_file_size: primaryMediaFile.size,
          chunk_count: Math.ceil(primaryMediaFile.size / CHUNK_SIZE),
          root_fingerprint: "root_" + Date.now(),
          original_filename: primaryMediaFile.name,
          covered_derivatives: [],
        },
        history: [],
      };

      const auditReason = targetCoverFileName
        ? `Covering "${targetCoverFileName}" with redacted copy — ${redactReason}`
        : redactReason;

      const updated = await linkDerivative(
        currentPassport,
        redactFile,
        auditReason,
        officer,
        keypair.privateKey,
        keypair.publicKey
      );

      const updatedDerivatives = [...derivativesList, redactFile];
      setPassport(updated);
      setDerivativesList(updatedDerivatives);
      setActivePreviewFile(redactFile);
      setPreviewUrl(URL.createObjectURL(redactFile));

      setShowRedactModal(false);
      setRedactStep(1);
      setTargetCoverFileName("");
      setRedactFile(null);
      setStatusMsg(`Privacy redacted version attached! In Public/Courtroom view, "${targetCoverFileName || 'original'}" will be concealed and this redacted copy will be displayed.`);
    } catch (err) {
      setStatus("error");
      setStatusMsg(err instanceof Error ? err.message : "Failed to attach privacy redaction.");
    }
  };



  // Attach Supporting Files (Supports Multiple Files & Dropzone with Custody Signing)
  const handleAttachSupportingFiles = async () => {
    if (supportingFiles.length === 0 || !primaryMediaFile || !officer || !keypair) return;
    setStatus("processing");
    setStatusMsg("Signing custody chain for supporting file attachments...");

    try {
      const names = supportingFiles.map((f) => f.name).join(", ");
      const noteText = `Attached ${supportingFiles.length} supporting file(s): ${names}`;
      
      const currentPassport = passport || {
        format_version: "1.0",
        case_id: caseId,
        blueprint: {
          chunk_size_bytes: CHUNK_SIZE as 2097152,
          total_file_size: primaryMediaFile.size,
          chunk_count: Math.ceil(primaryMediaFile.size / CHUNK_SIZE),
          root_fingerprint: "root_" + Date.now(),
          original_filename: primaryMediaFile.name,
          covered_derivatives: [],
        },
        history: [],
      };

      const updatedPassport = await appendHandover(
        currentPassport,
        officer,
        noteText,
        keypair.privateKey,
        keypair.publicKey
      );

      const updatedDerivatives = [...derivativesList, ...supportingFiles];
      setPassport(updatedPassport);
      setDerivativesList(updatedDerivatives);
      
      const lastAttached = supportingFiles[supportingFiles.length - 1];
      setActivePreviewFile(lastAttached);
      setPreviewUrl(URL.createObjectURL(lastAttached));

      const lastRec = updatedPassport.history?.[updatedPassport.history.length - 1];
      if (lastRec && isOnline) {
        fetch("/api/custody", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            evidence_id: updatedPassport.evidenceId || updatedPassport.evidenceMetadata?.evidenceId || `EVD-${caseId}`,
            timestamp: lastRec.timestamp,
            actor_badge_id: officer.badgeId,
            actor_name: officer.fullName,
            action: "Supporting File Attached",
            notes: noteText,
            canonical_hash: lastRec.signature || "hash",
            signature: lastRec.signature || "sig",
            public_stamp: officer.publicStamp || "",
          }),
        }).catch(() => {});
      }

      const count = supportingFiles.length;
      setShowAttachModal(false);
      setSupportingFiles([]);
      setStatus("done");
      setStatusMsg(`${count} supporting document${count > 1 ? "s" : ""} attached and signed into chain of custody.`);
    } catch (err) {
      setStatus("error");
      setStatusMsg(err instanceof Error ? err.message : "Failed to attach supporting files.");
    }
  };

  // Save & Download Final Updated .proof Container
  const handleFinalSaveAndDownload = async () => {
    if (!officerNote.trim()) {
      setStatus("error");
      setStatusMsg("A note is required before downloading the evidence bag.");
      return;
    }
    if (!primaryMediaFile || !officer || !keypair) {
      setStatus("error");
      setStatusMsg("Please open an evidence bag or pack evidence first.");
      return;
    }

    setStatus("processing");
    setStatusMsg("Signing custody session & packaging updated evidence container...");

    try {
      const currentPassport = passport || {
        format_version: "1.0",
        case_id: caseId,
        blueprint: {
          chunk_size_bytes: CHUNK_SIZE as 2097152,
          total_file_size: primaryMediaFile.size,
          chunk_count: Math.ceil(primaryMediaFile.size / CHUNK_SIZE),
          root_fingerprint: "root_" + Date.now(),
          original_filename: primaryMediaFile.name,
          covered_derivatives: [],
        },
        history: [],
      };

      const noteToSave = officerNote.trim();

      const updatedPassport = await appendHandover(
        currentPassport,
        officer,
        noteToSave,
        keypair.privateKey,
        keypair.publicKey
      );

      setPassport(updatedPassport);

      // Sync custody record to server SQLite DB if online
      const lastRec = updatedPassport.history?.[updatedPassport.history.length - 1];
      if (lastRec && isOnline) {
        try {
          await fetch("/api/custody", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              evidence_id: updatedPassport.evidenceId || updatedPassport.evidenceMetadata?.evidenceId || `EVD-${caseId}`,
              timestamp: lastRec.timestamp,
              actor_badge_id: officer.badgeId,
              actor_name: officer.fullName,
              action: "Container Exported",
              notes: noteToSave,
              canonical_hash: lastRec.signature || "hash",
              signature: lastRec.signature || "sig",
              public_stamp: officer.publicStamp || "",
            }),
          });
        } catch (e) {
          console.error("Failed to sync custody record to server:", e);
        }
      }

      const blob = await packProof(updatedPassport, primaryMediaFile, derivativesList);
      const downloadName = generateProofFileName(caseId, officer.badgeId);
      downloadProof(blob, downloadName);

      setOfficerNote("");
      setStatus("done");
      setStatusMsg(`Updated container "${downloadName}" signed with custody record and downloaded successfully!`);
    } catch (err) {
      setStatus("error");
      setStatusMsg(err instanceof Error ? err.message : "Failed to sign and package container.");
    }
  };

  // Compiled enclosed files: Primary file + all derivatives
  const allEnclosedFiles: Array<{ file: File; isPrimary: boolean; isRedacted: boolean }> = [];
  if (primaryMediaFile) {
    allEnclosedFiles.push({ file: primaryMediaFile, isPrimary: true, isRedacted: false });
  }
  derivativesList.forEach((d) => {
    const isRed = passport?.blueprint?.covered_derivatives?.some((cd) => cd.filename === d.name) || false;
    allEnclosedFiles.push({ file: d, isPrimary: false, isRedacted: isRed });
  });

  const custodyHistory: CustodyRecord[] = passport?.history || [];

  // Helper to test if a file is supported by in-browser Redaction Studio
  const isRedactableFile = (file: File | null): boolean => {
    if (!file) return false;
    if (file.name.endsWith(".proof")) return false;
    const mime = getMimeTypeFromName(file.name, file.type);
    return (
      mime.startsWith("image/") ||
      mime.startsWith("video/") ||
      mime === "application/pdf" ||
      file.name.endsWith(".pdf") ||
      mime.startsWith("text/") ||
      file.name.endsWith(".txt") ||
      file.name.endsWith(".csv") ||
      file.name.endsWith(".json")
    );
  };

  // Target file candidates for Cover Private Details modal (all enclosed files)
  const targetFileCandidates = allEnclosedFiles;

  // Helper to find selected target file object for step 1 redaction download
  const selectedTargetFileObj = targetFileCandidates.find((ef) => ef.file.name === targetCoverFileName)?.file || targetFileCandidates[0]?.file || null;

  return (
    <div className="bg-[#f9f9fa] text-[#1a1c1d] font-sans min-h-screen py-6 space-y-6">
      
      {/* Hidden file inputs */}
      <input
        ref={proofRef}
        type="file"
        accept=".proof"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleOpenProofFile(e.target.files[0])}
      />

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-200 pb-5">
        <div>
          <div className="flex items-center gap-2 text-neutral-500 text-xs font-mono">
            <span>OFFICER DESK</span>
            {caseId && (
              <>
                <span>•</span>
                <span className="text-black font-bold">{caseId}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-black mt-1">
            {caseTitle || "Digital Evidence Bag Management"}
          </h1>
        </div>

        {/* Workspace Switcher */}
        <div className="inline-flex p-1 bg-neutral-200/70 rounded-xl self-start sm:self-auto shadow-xs border border-neutral-300">
          <button
            onClick={() => setWorkspaceMode("open_bag")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              workspaceMode === "open_bag"
                ? "bg-white text-black shadow-xs font-bold"
                : "text-neutral-700 hover:text-black hover:bg-neutral-100"
            }`}
          >
            <FolderOpen className="w-4 h-4 text-black" />
            <span>Open Evidence Bag (.proof)</span>
          </button>

          <button
            onClick={() => setWorkspaceMode("pack_new")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              workspaceMode === "pack_new"
                ? "bg-white text-black shadow-xs font-bold"
                : "text-neutral-700 hover:text-black hover:bg-neutral-100"
            }`}
          >
            <Package className="w-4 h-4 text-black" />
            <span>Pack New Evidence</span>
          </button>
        </div>
      </div>

      {primaryMediaFile && (
        <div className="space-y-4">
          {verificationResult && !verificationResult.overall && (
            <div className="w-full bg-rose-50 border-2 border-rose-300 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-rose-950 shadow-sm">
              <div className="flex items-start sm:items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <XCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-rose-950">Container Tampering Alert Triggered</h3>
                  <p className="text-xs text-rose-800 mt-0.5">
                    Warning: Container structure, cryptographic Merkle fingerprint, or custody signature checks failed. This evidence container has been modified or corrupted.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowVerifyModal(true)}
                className="px-4 py-2 bg-rose-700 hover:bg-rose-800 text-white rounded-xl text-xs font-bold shrink-0 shadow-xs cursor-pointer"
              >
                View Audit Breakdown
              </button>
            </div>
          )}

          <div className="w-full bg-white rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs border border-[#e4e4e7]">
            <div className="flex items-center gap-2.5 flex-wrap text-xs">
              {verificationResult && !verificationResult.overall ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-900 border border-rose-300 font-bold text-xs">
                  <XCircle className="w-4 h-4 text-rose-700" />
                  Tamper Alert Triggered — Verification Failed
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  Tamper-Sealed Container Open
                </span>
              )}
              <span className="text-neutral-400 hidden sm:inline">•</span>
              <span className="font-mono text-neutral-600 text-xs">
                Bag File: <strong className="text-black">{bagFileName || primaryMediaFile.name}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleVerifyOpenBag}
                disabled={isVerifyingBag}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer ${
                  verificationResult && !verificationResult.overall
                    ? "bg-rose-600 hover:bg-rose-700 text-white"
                    : "bg-black hover:bg-neutral-800 text-white"
                }`}
                title="Run full cryptographic SHA-256 Merkle root & ECDSA signature audit on this bag"
              >
                {isVerifyingBag ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Verifying…</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className={`w-4 h-4 ${verificationResult && !verificationResult.overall ? "text-white" : "text-emerald-400"}`} />
                    <span>{verificationResult && !verificationResult.overall ? "View Tamper Audit" : "Verify Bag Integrity"}</span>
                  </>
                )}
              </button>
              <button
                onClick={handleClearWorkspace}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-600 hover:text-black font-semibold text-xs transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close Bag</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {(!primaryMediaFile || workspaceMode === "pack_new") && (
        <div className="bg-white rounded-2xl border border-[#e4e4e7] p-6 sm:p-10 space-y-6 shadow-sm">
          {workspaceMode === "pack_new" ? (
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b border-neutral-100 pb-4">
                <div>
                  <h2 className="text-xl font-bold text-black">Pack New Digital Evidence</h2>
                  <p className="text-xs text-neutral-500 mt-1">Select one or multiple raw evidence files (videos, photos, logs, documents) to create a sealed .proof container.</p>
                </div>
                {primaryMediaFile && (
                  <button
                    onClick={() => setWorkspaceMode("open_bag")}
                    className="text-xs text-neutral-500 hover:text-black font-mono underline"
                  >
                    Return to Active Bag
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1.5">Case Reference Number *</label>
                  <input
                    type="text"
                    value={newCaseId}
                    onChange={(e) => setNewCaseId(e.target.value)}
                    placeholder="e.g. EFCC/CR/2026/0492"
                    className="w-full bg-[#f3f3f4] border border-neutral-300 rounded-xl px-4 py-3 text-sm text-black outline-none focus:bg-white focus:border-black transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-1.5">Case Description / Exhibit Title</label>
                  <input
                    type="text"
                    value={newCaseTitle}
                    onChange={(e) => setNewCaseTitle(e.target.value)}
                    placeholder="e.g. Surveillance Footage & Context Logs"
                    className="w-full bg-[#f3f3f4] border border-neutral-300 rounded-xl px-4 py-3 text-sm text-black outline-none focus:bg-white focus:border-black transition-all"
                  />
                </div>
              </div>

              {/* Multi-File Upload & Drop Zone */}
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    setNewFiles(Array.from(e.dataTransfer.files));
                  }
                }}
                onClick={() => newFileRef.current?.click()}
                className="border-2 border-dashed border-neutral-300 hover:border-black bg-[#f9f9fa] rounded-2xl p-8 text-center cursor-pointer space-y-3 transition-all"
              >
                <input
                  ref={newFileRef}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => e.target.files && setNewFiles(Array.from(e.target.files))}
                />
                <FolderOpen className="w-10 h-10 text-neutral-400 mx-auto" />
                <p className="text-sm font-bold text-black">Select or drop raw evidence file(s) here</p>
                <p className="text-xs text-neutral-500">Supports multiple files simultaneously (videos, audio, photos, logs, documents)</p>
              </div>

              {/* List of Selected Files for Packing */}
              {newFiles.length > 0 && (
                <div className="space-y-2.5 bg-neutral-50 p-4 rounded-xl border border-neutral-200">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-black">Enclosed Exhibits ({newFiles.length}):</span>
                    <button
                      type="button"
                      onClick={() => newFileRef.current?.click()}
                      className="text-xs font-semibold text-black hover:underline flex items-center gap-1"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-neutral-600" />
                      <span>+ Add Supporting Exhibits</span>
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {newFiles.map((f, i) => (
                      <div key={i} className="flex items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-neutral-200">
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="w-4 h-4 text-neutral-600 flex-shrink-0" />
                          <span className="font-semibold text-black truncate">{f.name}</span>
                          <span className="text-[10px] text-neutral-400 font-mono">({(f.size / 1024).toFixed(1)} KB)</span>
                          {i === 0 ? (
                            <span className="text-[10px] bg-black text-white px-1.5 py-0.5 rounded font-bold">Master Payload</span>
                          ) : (
                            <span className="text-[10px] bg-neutral-200 text-neutral-700 px-1.5 py-0.5 rounded font-bold">Supporting File</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setNewFiles(newFiles.filter((_, idx) => idx !== i));
                          }}
                          className="text-neutral-400 hover:text-rose-600 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Officer Note Area for Sealing */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-neutral-800">Officer Sealing Note *</label>
                <textarea
                  value={newSealingNote}
                  onChange={(e) => setNewSealingNote(e.target.value)}
                  rows={2}
                  placeholder="Enter initial officer note or context for sealing this evidence bag..."
                  className="w-full bg-[#f3f3f4] border border-neutral-300 rounded-xl p-3 text-xs text-black outline-none focus:bg-white focus:border-black transition-all resize-none"
                />
              </div>

              {/* Dual Action Buttons: Seal to Workspace vs Seal & Download */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  disabled={newFiles.length === 0 || !newCaseId || status === "processing"}
                  onClick={() => handleCreateNewBag(false)}
                  className="py-3.5 px-4 bg-white hover:bg-neutral-100 border border-neutral-300 text-black rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-xs"
                >
                  {status === "processing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4 text-emerald-600" />}
                  <span>Generate & Seal to Workspace</span>
                </button>

                <button
                  disabled={newFiles.length === 0 || !newCaseId || status === "processing"}
                  onClick={() => handleCreateNewBag(true)}
                  className="py-3.5 px-4 bg-black hover:bg-neutral-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md"
                >
                  {status === "processing" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4 text-emerald-400" />}
                  <span>Generate, Seal & Download (.proof)</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-4xl mx-auto py-6 space-y-6">
              <div
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleOpenProofFile(e.dataTransfer.files[0]);
                  }
                }}
                onClick={() => proofRef.current?.click()}
                className="relative group cursor-pointer bg-white rounded-3xl p-10 sm:p-14 text-center shadow-xs hover:shadow-md border border-[#e4e4e7] hover:border-black transition-all duration-200 overflow-hidden"
              >
                {status === "processing" ? (
                  <div className="relative z-10 flex flex-col items-center justify-center max-w-xl mx-auto py-8 space-y-4">
                    <div className="w-16 h-16 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-black">
                      <Loader2 className="w-8 h-8 text-black animate-spin" />
                    </div>
                    <h2 className="text-xl font-bold text-black">Importing & Verifying Evidence Container…</h2>
                    <p className="text-xs text-neutral-500 font-mono">{statusMsg || "Unpacking .proof file and extracting enclosed exhibits..."}</p>
                  </div>
                ) : (
                  <div className="relative z-10 flex flex-col items-center max-w-xl mx-auto">
                    <div className="relative mb-6">
                      <div className="w-20 h-20 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center text-black group-hover:scale-105 transition-transform duration-300">
                        <ShieldCheck className="w-10 h-10 text-black" />
                      </div>
                      <span className="absolute -bottom-1 -right-1 w-8 h-8 rounded-xl bg-black text-white flex items-center justify-center shadow-md">
                        <FolderOpen className="w-4 h-4 text-white" />
                      </span>
                    </div>

                    <h2 className="text-2xl font-bold tracking-tight text-black mb-2">
                      Drop your sealed evidence bag (.proof) here
                    </h2>
                    <p className="text-xs text-neutral-500 max-w-md mb-6 leading-relaxed">
                      or click to browse from your station computer or connected encrypted USB drive.
                    </p>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        proofRef.current?.click();
                      }}
                      className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-black hover:bg-neutral-800 text-white font-bold text-xs shadow-md transition-all active:scale-95"
                    >
                      <FolderOpen className="w-4 h-4" />
                      <span>Select .proof File</span>
                    </button>

                    <div className="mt-8 pt-6 border-t border-neutral-100 w-full flex items-center justify-center gap-2 text-neutral-500 text-xs font-mono">
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span>Standard container: <strong className="text-black font-semibold">.proof</strong> (packages)</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {primaryMediaFile && workspaceMode === "open_bag" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          <div className="lg:col-span-7 space-y-6">
            
            {/* Media Player / Previewer Box */}
            <div className="w-full bg-[#09090b] rounded-2xl overflow-hidden shadow-md flex flex-col border border-neutral-800">
              <div className="relative w-full aspect-video bg-[#09090b] flex items-center justify-center overflow-hidden">
                
                {activePreviewFile && previewUrl ? (() => {
                  const effectiveMime = getMimeTypeFromName(activePreviewFile.name, activePreviewFile.type);
                  if (effectiveMime.startsWith("image/")) {
                    return <img src={previewUrl} alt="Active preview" className="w-full h-full object-contain bg-black" />;
                  } else if (effectiveMime.startsWith("video/")) {
                    return <video src={previewUrl} controls className="w-full h-full object-contain bg-black" />;
                  } else if (effectiveMime.startsWith("audio/")) {
                    return (
                      <div className="p-8 text-center space-y-4">
                        <Volume2 className="w-16 h-16 text-neutral-300 mx-auto" />
                        <audio src={previewUrl} controls className="w-full max-w-md mx-auto" />
                      </div>
                    );
                  } else if (effectiveMime === "application/pdf") {
                    return <iframe src={previewUrl} title="PDF Preview" className="w-full h-full min-h-[360px] bg-white border-0" />;
                  } else if (activeTextContent !== null) {
                    return (
                      <div className="w-full h-full p-4 bg-[#121316] text-neutral-200 font-mono text-xs overflow-auto leading-relaxed border border-neutral-800">
                        <div className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2 border-b border-neutral-800 pb-1.5 flex items-center justify-between">
                          <span>Document Content View • {activePreviewFile.name}</span>
                          <span>({(activePreviewFile.size / 1024).toFixed(1)} KB)</span>
                        </div>
                        <pre className="whitespace-pre-wrap font-mono text-neutral-200">{activeTextContent || "[Empty Document File]"}</pre>
                      </div>
                    );
                  } else {
                    return (
                      <div className="p-8 text-center space-y-3">
                        <FileText className="w-16 h-16 text-neutral-400 mx-auto" />
                        <p className="text-sm font-bold text-white">{activePreviewFile.name}</p>
                        <p className="text-xs text-neutral-400">Document / Data File • {(activePreviewFile.size / 1024).toFixed(1)} KB</p>
                      </div>
                    );
                  }
                })() : (
                  <div className="p-8 text-center space-y-2">
                    <FileText className="w-12 h-12 text-neutral-600 mx-auto" />
                    <p className="text-sm font-semibold text-neutral-300">No Active File Selected</p>
                  </div>
                )}

                {/* Dynamic Timestamp Overlay */}
                {passport?.evidenceMetadata?.sealedAtTimestamp && (
                  <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md text-white text-xs font-mono">
                    <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>SEALED: {new Date(passport.evidenceMetadata.sealedAtTimestamp).toLocaleString()}</span>
                  </div>
                )}
                <div className="absolute top-4 right-4 px-2.5 py-1 rounded-md bg-black/80 backdrop-blur-md text-white text-[11px] font-mono">
                  OFFICIAL EXHIBIT
                </div>
              </div>

              {/* Video Controls Toolbar & Immediate Download Action */}
              <div className="p-4 bg-[#09090b] border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs text-white">
                <div className="font-mono text-neutral-400 truncate max-w-xs">
                  Active Display: <span className="text-white font-semibold">{activePreviewFile?.name || "None"}</span>
                </div>
                {activePreviewFile && (
                  <button
                    onClick={() => triggerFileDownload(activePreviewFile)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-black hover:bg-neutral-200 font-bold transition-colors shadow-xs text-xs"
                  >
                    <Download className="w-4 h-4 text-black" />
                    <span>Download File (Original)</span>
                  </button>
                )}
              </div>
            </div>

            {/* Enclosed Files List inside Evidence Bag */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#e4e4e7] space-y-4">
              <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
                <div>
                  <h3 className="text-base font-bold text-black">Enclosed Files in Evidence Bag ({allEnclosedFiles.length})</h3>
                  <p className="text-xs text-neutral-500 mt-0.5">Click any file to preview or download individual exhibit files.</p>
                </div>
              </div>

              {allEnclosedFiles.length === 0 ? (
                <p className="text-xs text-neutral-400 italic py-4 text-center">No files inside container.</p>
              ) : (
                <div className="space-y-2.5">
                  {allEnclosedFiles.map(({ file: f, isPrimary, isRedacted }, idx) => {
                    const mime = getMimeTypeFromName(f.name, f.type);
                    const isProofContainer = f.name.endsWith(".proof");
                    const isRedactable = !isProofContainer && (
                      mime.startsWith("image/") ||
                      mime.startsWith("video/") ||
                      mime === "application/pdf" ||
                      f.name.endsWith(".pdf") ||
                      mime.startsWith("text/") ||
                      f.name.endsWith(".txt") ||
                      f.name.endsWith(".csv") ||
                      f.name.endsWith(".json")
                    );

                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs transition-all ${
                          activePreviewFile?.name === f.name
                            ? "bg-neutral-100 border-neutral-400 font-semibold"
                            : "bg-[#f9f9fa] border-neutral-200 hover:bg-neutral-50"
                        }`}
                      >
                        <div
                          onClick={() => {
                            setActivePreviewFile(f);
                            setPreviewUrl(URL.createObjectURL(f));
                          }}
                          className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
                        >
                          <FileText className="w-5 h-5 text-neutral-700 flex-shrink-0" />
                          <div className="truncate">
                            <span className="font-bold text-black block truncate">{f.name}</span>
                            <span className="text-[11px] text-neutral-500 font-mono">
                              {(f.size / 1024).toFixed(1)} KB • {f.type || "Document / Data File"}
                              {isPrimary && <strong className="ml-2 text-black">[Master File]</strong>}
                              {isRedacted && <strong className="ml-2 text-amber-700">[Privacy Redacted Copy]</strong>}
                              {!isPrimary && !isRedacted && <strong className="ml-2 text-neutral-700">[Supporting Document]</strong>}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          {isRedactable && (
                            <button
                              onClick={() => {
                                setStudioTargetFile(f);
                                setShowStudio(true);
                              }}
                              className="px-3 py-1.5 rounded-lg bg-black text-white hover:bg-neutral-800 transition-colors text-xs font-bold flex items-center gap-1.5"
                              title="Open In-Browser Redaction Studio to mask faces/PII"
                            >
                              <Scissors className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Redact</span>
                            </button>
                          )}
                          <button
                            onClick={() => triggerFileDownload(f)}
                            className="px-3 py-1.5 rounded-lg bg-neutral-200 hover:bg-black hover:text-white transition-colors text-xs font-medium flex items-center gap-1.5"
                            title="Download file to computer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Evidence Metadata Details Card */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#e4e4e7] space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-black">Evidence Details</h2>
                <span className="px-3 py-1 rounded-full bg-neutral-100 text-neutral-700 font-semibold text-xs">
                  Sealed Container
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
                <div>
                  <span className="text-neutral-500 block">Case Reference</span>
                  <span className="font-bold text-black text-sm mt-0.5 block">{caseId || "N/A"}</span>
                </div>
                <div>
                  <span className="text-neutral-500 block">First Sealed Date</span>
                  <span className="font-semibold text-black mt-0.5 block">
                    {passport?.evidenceMetadata?.sealedAtTimestamp
                      ? new Date(passport.evidenceMetadata.sealedAtTimestamp).toLocaleString()
                      : "Recently Sealed"}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Container Format</span>
                  <span className="font-semibold text-black mt-0.5 block flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    .proof tamper-sealed container
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500 block">Primary Master Payload</span>
                  <span className="font-semibold text-black mt-0.5 block truncate">
                    {primaryMediaFile
                      ? `${(primaryMediaFile.size / 1024 / 1024).toFixed(2)} MB • ${primaryMediaFile.name}`
                      : "None"}
                  </span>
                </div>
              </div>
            </div>

          </div>

          <div className="lg:col-span-5 space-y-6">
            
            {/* Dynamic Handover History Card */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#e4e4e7] space-y-4">
              <div>
                <h2 className="text-base font-bold text-black">Chain of Custody Record</h2>
                <p className="text-xs text-neutral-500 mt-0.5">Chronological audit log of officer handovers & modifications.</p>
              </div>

              {custodyHistory.length === 0 ? (
                <p className="text-xs text-neutral-400 italic py-4 text-center">No custody entries found in container passport.</p>
              ) : (
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
                            <h3 className="font-bold text-black">{name}</h3>
                            {badgeId && <span className="text-[10px] font-mono text-neutral-400">{badgeId}</span>}
                          </div>
                          <p className="text-neutral-500 text-[11px]">{agency}</p>
                          {note && (
                            <p className="text-neutral-800 bg-white p-2 rounded-lg border border-neutral-200 mt-1 leading-relaxed">
                              &ldquo;{note}&rdquo;
                            </p>
                          )}
                          <span className="text-[10px] text-neutral-400 self-end font-mono mt-1">
                            {rec.timestamp ? new Date(rec.timestamp).toLocaleString() : ""}
                          </span>
                        </div>
                      </div>
                    );
                  })}

                  {/* Active Logged-in Officer Node */}
                  {officer && (
                    <div className="relative flex items-start gap-3 pt-1">
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 z-10 font-bold text-xs shadow-xs">
                        <ShieldCheck className="w-3.5 h-3.5 text-white" />
                      </div>
                      <div className="flex flex-col flex-1 bg-emerald-50/60 p-3.5 rounded-xl border border-emerald-200 text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <h3 className="font-bold text-black">{officer.fullName} ({officer.badgeId})</h3>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-700 text-white text-[10px] font-bold">Current Active Session</span>
                        </div>
                        <p className="text-neutral-600 text-[11px]">{officer.agency}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2 Working Action Buttons: Cover Private Details & Attach Supporting File */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              
              {/* Button 1: Cover Private Details (Redaction) */}
              <button
                onClick={() => {
                  setShowRedactModal(true);
                  setRedactStep(1);
                  setTargetCoverFileName(targetFileCandidates[0]?.file.name || "");
                }}
                className="flex flex-col text-left p-4 rounded-2xl bg-white hover:bg-neutral-100 border border-[#e4e4e7] shadow-xs transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-neutral-100 group-hover:bg-black group-hover:text-white text-black flex items-center justify-center transition-colors mb-3">
                  <EyeOff className="w-5 h-5" />
                </div>
                <span className="font-bold text-sm text-black">Cover Private Details</span>
                <span className="text-xs text-neutral-500 mt-1 leading-snug">
                  Redact face/PII. In public/review view, only the redacted version is shown.
                </span>
              </button>

              {/* Button 2: Attach Supporting File */}
              <button
                onClick={() => {
                  setShowAttachModal(true);
                  setSupportingFiles([]);
                }}
                className="flex flex-col text-left p-4 rounded-2xl bg-white hover:bg-neutral-100 border border-[#e4e4e7] shadow-xs transition-all group"
              >
                <div className="w-10 h-10 rounded-xl bg-neutral-100 group-hover:bg-black group-hover:text-white text-black flex items-center justify-center transition-colors mb-3">
                  <Paperclip className="w-5 h-5" />
                </div>
                <span className="font-bold text-sm text-black">Attach Supporting File</span>
                <span className="text-xs text-neutral-500 mt-1 leading-snug">
                  Add another document, photo, or report to this bag.
                </span>
              </button>
            </div>

            {/* Officer Note Card */}
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-[#e4e4e7] space-y-4">
              <div>
                <label htmlFor="officer-notes" className="text-base font-bold text-black flex items-center gap-1.5">
                  <span>Note</span>
                  <span className="text-rose-600 font-semibold text-xs">* Required to download</span>
                </label>
                <p className="text-xs text-neutral-500 mt-0.5">
                  Explain actions or edits performed during this session. Note is saved to the custody record.
                </p>
              </div>

              <textarea
                id="officer-notes"
                value={officerNote}
                onChange={(e) => setOfficerNote(e.target.value)}
                rows={3}
                placeholder="Enter note before downloading container..."
                className="w-full bg-[#f3f3f4] text-black text-xs rounded-xl p-3.5 focus:outline-none focus:bg-white border border-neutral-300 transition-all resize-none font-sans"
              />

              {/* Status Feedback Banner */}
              {status === "done" && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{statusMsg}</span>
                </div>
              )}
              {status === "error" && (
                <div className="p-3.5 bg-rose-50 border border-rose-300 text-rose-800 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{statusMsg}</span>
                </div>
              )}

              {/* Big Primary Final Button */}
              <div className="space-y-2 pt-1">
                <button
                  disabled={!officerNote.trim() || status === "processing"}
                  onClick={handleFinalSaveAndDownload}
                  className="w-full py-4 px-6 rounded-full bg-black hover:bg-neutral-800 disabled:opacity-40 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                >
                  {status === "processing" ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                  <span>Download Evidence Bag (.proof)</span>
                </button>
                <p className="text-[11px] text-center text-neutral-500 leading-relaxed px-2">
                  Signing and packing automatically adds your officer name and timestamp into the history.
                </p>
              </div>
            </div>

          </div>
        </div>
      )}

      {showRedactModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#e4e4e7]">
            <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2 text-black font-bold">
                <EyeOff className="w-5 h-5 text-black" />
                <span>Cover Private Details (Redaction)</span>
              </div>
              <button onClick={() => setShowRedactModal(false)} className="text-xs text-neutral-400 hover:text-black">✕</button>
            </div>

            {/* Step 1: Target File Selection & Direct Download Instructions */}
            {redactStep === 1 && (
              <div className="space-y-4">
                <div className="p-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs space-y-1.5 text-neutral-700 leading-relaxed">
                  <span className="font-bold text-black block">Instructions for Redaction:</span>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Select the target file below you wish to cover/redact.</li>
                    <li>For supported media & documents, click <strong>&quot;Launch Interactive Redaction Studio&quot;</strong> to redact in-browser.</li>
                    <li>For manual redaction or offline formats, click <strong>&quot;Download Selected File to Edit&quot;</strong> to edit on your workstation.</li>
                    <li>Click <strong>&quot;Manual Upload: Attach Pre-Redacted Version&quot;</strong> to link your redacted copy.</li>
                  </ol>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-800 mb-2">1. Select Target File to Redact *</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {targetFileCandidates.length === 0 ? (
                      <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-400 italic text-center">
                        No files found in container.
                      </div>
                    ) : (
                      targetFileCandidates.map(({ file: f, isPrimary, isRedacted }, i) => (
                        <label
                          key={i}
                          className={`flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                            targetCoverFileName === f.name
                              ? "bg-neutral-100 border-black font-bold"
                              : "bg-neutral-50 border-neutral-200 hover:bg-neutral-100"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 truncate">
                            <input
                              type="radio"
                              name="targetCover"
                              checked={targetCoverFileName === f.name}
                              onChange={() => setTargetCoverFileName(f.name)}
                              className="accent-black"
                            />
                            <span className="truncate text-black">{f.name}</span>
                          </div>
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {isPrimary ? "[Master File]" : isRedacted ? "[Redacted Copy]" : "[Supporting Document]"}
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Render Launch Interactive Redaction Studio ONLY when selectedTargetFileObj is supported */}
                {selectedTargetFileObj && isRedactableFile(selectedTargetFileObj) && (
                  <button
                    onClick={() => {
                      setStudioTargetFile(selectedTargetFileObj);
                      setShowRedactModal(false);
                      setShowStudio(true);
                    }}
                    className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-md"
                  >
                    <Scissors className="w-4 h-4 text-emerald-400" />
                    <span>Launch Interactive Redaction Studio</span>
                  </button>
                )}

                {/* Manual Offline Download & Redact Flow (Available for all files) */}
                {selectedTargetFileObj && (
                  <button
                    type="button"
                    onClick={() => triggerFileDownload(selectedTargetFileObj)}
                    className="w-full py-2.5 bg-neutral-50 hover:bg-neutral-100 border border-neutral-200 text-neutral-700 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all"
                  >
                    <Download className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Download &quot;{selectedTargetFileObj.name}&quot; to Edit Offline</span>
                  </button>
                )}

                <button
                  disabled={!targetCoverFileName}
                  onClick={() => setRedactStep(2)}
                  className="w-full py-2.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 disabled:opacity-40 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                >
                  <span>Manual Upload: Attach Pre-Redacted Version</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Step 2: Upload Redacted Copy & Reason */}
            {redactStep === 2 && (
              <div className="space-y-4">
                <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-xl text-xs">
                  <span className="text-neutral-500 block">Target File to Cover in Public View:</span>
                  <span className="font-bold text-black block truncate mt-0.5">{targetCoverFileName}</span>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1">Upload Edited / Redacted File *</label>
                    <input
                      ref={redactRef}
                      type="file"
                      onChange={(e) => e.target.files?.[0] && setRedactFile(e.target.files[0])}
                      className="w-full bg-[#f3f3f4] border border-neutral-300 rounded-xl p-2.5 text-xs text-black"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-800 mb-1">File Description (What was redacted) *</label>
                    <input
                      type="text"
                      value={redactReason}
                      onChange={(e) => setRedactReason(e.target.value)}
                      placeholder="e.g. Obscured facial PII and sensitive numbers"
                      className="w-full bg-[#f3f3f4] border border-neutral-300 rounded-xl p-3 text-xs text-black outline-none focus:bg-white border-neutral-300"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setRedactStep(1)}
                    className="w-1/3 py-3 bg-neutral-100 hover:bg-neutral-200 text-black rounded-xl text-xs font-semibold transition-all"
                  >
                    Back
                  </button>
                  <button
                    disabled={!redactFile || !redactReason}
                    onClick={handleApplyRedaction}
                    className="w-2/3 py-3 bg-black hover:bg-neutral-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all"
                  >
                    Attach & Link Redacted Version
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showAttachModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-[#e4e4e7]">
            <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2 text-black font-bold">
                <Paperclip className="w-5 h-5 text-black" />
                <span>Attach Supporting File(s)</span>
              </div>
              <button onClick={() => setShowAttachModal(false)} className="text-xs text-neutral-400 hover:text-black">✕</button>
            </div>

            <p className="text-xs text-neutral-600 leading-relaxed">
              Drag & drop or select supporting documents, context photos, field notes, or logs to attach to this evidence container.
            </p>

            {/* Drop Zone inside Modal */}
            <div
              onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  setSupportingFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
                }
              }}
              onClick={() => attachRef.current?.click()}
              className="border-2 border-dashed border-neutral-300 hover:border-black bg-[#f9f9fa] rounded-xl p-6 text-center cursor-pointer space-y-2 transition-all"
            >
              <input
                ref={attachRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    setSupportingFiles((prev) => [...prev, ...Array.from(files)]);
                  }
                }}
              />
              <Upload className="w-8 h-8 text-neutral-400 mx-auto" />
              <p className="text-xs font-bold text-black">Click or drop file(s) here</p>
              <p className="text-[11px] text-neutral-500">Supports selecting multiple supporting files</p>
            </div>

            {/* Selected files list inside modal */}
            {supportingFiles.length > 0 && (
              <div className="space-y-1.5 max-h-36 overflow-y-auto bg-neutral-50 p-2.5 rounded-xl border border-neutral-200">
                <span className="text-[11px] font-bold text-black block mb-1">Selected Files ({supportingFiles.length}):</span>
                {supportingFiles.map((f, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-white p-2 rounded-lg border border-neutral-200">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" />
                      <span className="font-semibold text-black truncate">{f.name}</span>
                      <span className="text-[10px] text-neutral-400 font-mono">({(f.size / 1024).toFixed(1)} KB)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSupportingFiles(supportingFiles.filter((_, idx) => idx !== i))}
                      className="text-neutral-400 hover:text-rose-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <button
              disabled={supportingFiles.length === 0}
              onClick={handleAttachSupportingFiles}
              className="w-full py-3 bg-black hover:bg-neutral-800 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all"
            >
              Attach {supportingFiles.length > 0 ? `${supportingFiles.length} File${supportingFiles.length > 1 ? "s" : ""}` : ""} to Evidence Bag
            </button>
          </div>
        </div>
      )}

      {/* Cryptographic Verification Audit Modal */}
      {showVerifyModal && verificationResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs font-sans">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl border border-[#e4e4e7] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-neutral-100 pb-3">
              <div className="flex items-center gap-2 text-black font-bold">
                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                <span>Cryptographic Integrity Audit Report</span>
              </div>
              <button onClick={() => setShowVerifyModal(false)} className="text-xs text-neutral-400 hover:text-black font-mono">✕</button>
            </div>

            {/* Overall Verdict Banner */}
            <div className={`p-4 rounded-xl border flex items-center gap-3 ${
              verificationResult.overall
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : "bg-rose-50 border-rose-200 text-rose-900"
            }`}>
              {verificationResult.overall ? (
                <FileCheck className="w-7 h-7 text-emerald-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-7 h-7 text-rose-600 flex-shrink-0" />
              )}
              <div>
                <h4 className="text-sm font-bold">
                  {verificationResult.overall ? "100% VERIFIED AUTHENTIC" : "INTEGRITY AUDIT FAILED / TAMPERED"}
                </h4>
                <p className="text-xs opacity-90 mt-0.5">
                  {verificationResult.overall
                    ? "Unbroken chain of custody verified. Merkle root & ECDSA signatures match genesis seal."
                    : "Discrepancies found in file hash or signature chain. Evidence may have been altered."}
                </p>
              </div>
            </div>

            {/* Detailed Checks Breakdown */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-black uppercase tracking-wider block">Cryptographic Check Breakdown ({verificationResult.details.length} Tests):</span>
              <div className="space-y-1.5 max-h-60 overflow-y-auto bg-neutral-50 p-3 rounded-xl border border-neutral-200 text-xs font-mono">
                {verificationResult.details.map((d, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-white rounded-lg border border-neutral-200">
                    <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${d.pass ? "bg-emerald-500" : "bg-rose-500"}`} />
                    <div>
                      <span className="font-bold text-black">{d.label}: </span>
                      <span className="text-neutral-700 text-[11px]">{d.message}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
              <a
                href="/verify"
                className="text-xs font-semibold text-neutral-600 hover:text-black underline flex items-center gap-1"
              >
                <span>View Full Public Verification Portal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </a>
              <button
                onClick={() => setShowVerifyModal(false)}
                className="px-5 py-2.5 bg-black hover:bg-neutral-800 text-white font-bold text-xs rounded-xl shadow-xs transition-all"
              >
                Close Audit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Native Redaction Studio Modal */}
      {showStudio && (studioTargetFile || primaryMediaFile) && (
        <RedactionStudio
          file={studioTargetFile || primaryMediaFile!}
          onClose={() => setShowStudio(false)}
          onCommit={handleCommitStudioRedaction}
        />
      )}

    </div>
  );
}

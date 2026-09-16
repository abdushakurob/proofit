"use client";

import React, { useState } from "react";
import { Zap, Download, Loader2, AlertTriangle } from "lucide-react";
import { unpackProof } from "@/modules/container/unpack";
import { packProof, downloadProof } from "@/modules/container/pack";

interface TamperHarnessProps {
  /** Only shown when a .proof file has been verified — pass the original file */
  proofFile?: File | null;
}

export default function TamperHarness({ proofFile }: TamperHarnessProps) {
  const [status, setStatus] = useState<"idle" | "tampering">("idle");
  const [lastAction, setLastAction] = useState("");

  if (!proofFile) return null;

  /** Simulate media tampering — flip 1 byte in the media payload */
  const tamperMedia = async () => {
    setStatus("tampering");
    setLastAction("media");

    try {
      const { passport, mediaFile, derivatives } = await unpackProof(proofFile);

      // Read media into buffer and flip 1 byte
      const buffer = await mediaFile.arrayBuffer();
      const tampered = new Uint8Array(buffer);
      // Flip the byte at ~10% offset (avoid ZIP headers)
      const flipIndex = Math.floor(tampered.length * 0.1);
      tampered[flipIndex] = tampered[flipIndex] ^ 0xff;

      const tamperedFile = new File([tampered], mediaFile.name);
      const blob = await packProof(passport, tamperedFile, derivatives);
      downloadProof(blob, `TAMPERED_MEDIA_${passport.case_id}.proof`);
    } catch (err) {
      console.error("Tamper media failed:", err);
    }

    setStatus("idle");
  };

  /** Simulate metadata tampering — alter custody note without re-signing */
  const tamperMetadata = async () => {
    setStatus("tampering");
    setLastAction("metadata");

    try {
      const { passport, mediaFile, derivatives } = await unpackProof(proofFile);

      // Alter the last custody entry's note without re-signing
      const tamperedPassport = {
        ...passport,
        history: passport.history.map((entry, i) =>
          i === passport.history.length - 1
            ? { ...entry, data: { ...entry.data, note: entry.data.note + " [TAMPERED]" } }
            : entry
        ),
      };

      const blob = await packProof(tamperedPassport, mediaFile, derivatives);
      downloadProof(blob, `TAMPERED_NOTE_${passport.case_id}.proof`);
    } catch (err) {
      console.error("Tamper metadata failed:", err);
    }

    setStatus("idle");
  };

  return (
    <div className="rounded-2xl p-5 animate-fade-in"
         style={{
           background: "oklch(0.20 0.04 30 / 0.4)",
           border: "1px solid oklch(0.63 0.22 25 / 0.2)",
         }}>
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-4 h-4" style={{ color: "var(--color-tampered)" }} />
        <h3 className="text-xs font-semibold uppercase tracking-wider"
            style={{ color: "var(--color-tampered)" }}>
          Evaluator Tamper Harness
        </h3>
      </div>
      <p className="text-xs mb-4" style={{ color: "var(--color-text-muted)" }}>
        Generate deliberately tampered .proof files for demonstration. Load them in Court Review
        to see the 🔴 verification failure.
      </p>

      <div className="flex gap-2">
        <button
          onClick={tamperMedia}
          disabled={status === "tampering"}
          className="btn btn-danger flex-1 text-xs py-2.5 disabled:opacity-40"
        >
          {status === "tampering" && lastAction === "media" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Zap className="w-3.5 h-3.5" />
          )}
          Flip Media Byte
        </button>
        <button
          onClick={tamperMetadata}
          disabled={status === "tampering"}
          className="btn btn-danger flex-1 text-xs py-2.5 disabled:opacity-40"
        >
          {status === "tampering" && lastAction === "metadata" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Zap className="w-3.5 h-3.5" />
          )}
          Alter Custody Note
        </button>
      </div>
    </div>
  );
}

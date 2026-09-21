import { computeMerkleRoot } from "@/modules/hasher/merkle";
import { verifySignature } from "@/modules/ledger/signer";
import type { Passport, VerificationResult, VerificationDetail, CustodyRecord } from "@/types";

const CHUNK_SIZE = 2 * 1024 * 1024;
const GENESIS_PREV_SIG = "0".repeat(64);

/* ── Helpers ────────────────────────────────────────────── */

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Import a raw ECDSA P-256 public key from hex string.
 */
async function importPublicKey(hexStamp: string): Promise<CryptoKey> {
  const raw = hexToBytes(hexStamp);
  return crypto.subtle.importKey(
    "raw",
    raw as unknown as BufferSource,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );
}

/**
 * Hash a file in 2MB chunks (inline, no Worker).
 */
async function hashFileToLeaves(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string[]> {
  const leaves: string[] = [];
  let offset = 0;
  const total = file.size;

  while (offset < total) {
    const end = Math.min(offset + CHUNK_SIZE, total);
    const slice = file.slice(offset, end);
    const buffer = await slice.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buffer);
    const hex = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    leaves.push(hex);
    offset = end;
    onProgress?.(Math.round((offset / total) * 100));
  }

  return leaves;
}

/* ── Pass 1: Media Integrity ────────────────────────────── */

async function verifyPass1(
  passport: Passport,
  mediaFile: File,
  onProgress?: (percent: number) => void
): Promise<VerificationDetail[]> {
  const details: VerificationDetail[] = [];

  try {
    // Hash the media file
    const leaves = await hashFileToLeaves(mediaFile, onProgress);
    const computedRoot = await computeMerkleRoot(leaves);

    // Check chunk count
    const chunkCountMatch = leaves.length === (passport.blueprint?.chunk_count || 0);
    details.push({
      pass: chunkCountMatch,
      label: "Data Structure Integrity",
      message: chunkCountMatch
        ? "Container file structure verified authentic."
        : "Container structure modified: File internal organization does not match the official seal record.",
    });

    // Check file size
    const expectedSize = passport.blueprint?.total_file_size || 0;
    const sizeMatch = mediaFile.size === expectedSize;
    details.push({
      pass: sizeMatch,
      label: "Evidence File Byte Size",
      message: sizeMatch
        ? "File size matches original sealed record."
        : "File size altered: Evidence payload size differs from the registered seal.",
    });

    // Check Merkle root (Original Evidence OR Sealed Redacted Derivative)
    const derivatives = passport.blueprint?.covered_derivatives || [];
    const expectedRoot = passport.blueprint?.root_fingerprint || "";
    const originalRootMatch = Boolean(expectedRoot && computedRoot === expectedRoot);
    const matchingDerivative = derivatives.find((d) => d.fingerprint === computedRoot);

    if (originalRootMatch) {
      details.push({
        pass: true,
        label: "Cryptographic Fingerprint Audit",
        message: "Digital seal verified 100% authentic — Evidence file content is untouched.",
      });
    } else if (matchingDerivative) {
      const tagStr = matchingDerivative.tags?.length ? ` [Tags: ${matchingDerivative.tags.join(", ")}]` : "";
      details.push({
        pass: true,
        label: "Cryptographic Fingerprint Audit (Redacted Copy)",
        message: `Digital seal matches registered derivative "${matchingDerivative.filename}" (${matchingDerivative.redaction_type || "Privacy Redaction"}${tagStr}).`,
      });
    } else {
      details.push({
        pass: false,
        label: "Cryptographic Fingerprint Audit",
        message: "Digital seal mismatch: Evidence content has been modified since initial sealing.",
      });
    }

    // Verify registered derivatives count
    if (derivatives.length > 0) {
      details.push({
        pass: true,
        label: "Registered Redacted Derivatives",
        message: `${derivatives.length} privacy-masked derivative copy/copies recorded in evidence passport.`,
      });
    }
  } catch (err) {
    details.push({
      pass: false,
      label: "Cryptographic Fingerprint Audit",
      message: "Media integrity check failed: Evidence payload unreadable or corrupted.",
    });
  }

  return details;
}

/* ── Pass 2: Chain & Signature Integrity ────────────────── */

async function verifyPass2(passport: Passport): Promise<VerificationDetail[]> {
  const details: VerificationDetail[] = [];
  const history = passport.history || [];

  if (history.length === 0) {
    details.push({
      pass: false,
      label: "Chain of Custody History",
      message: "Custody record incomplete: No officer handover records or signatures found.",
    });
    return details;
  }

  // Check genesis record
  const genesis = history[0];
  const genesisAnchorValid = genesis.previous_signature === GENESIS_PREV_SIG;
  details.push({
    pass: genesisAnchorValid,
    label: "Initial Sealing Anchor",
    message: genesisAnchorValid
      ? "Genesis record anchor verified authentic."
      : "Initial seal broken: The original sealing record anchor is invalid or tampered with.",
  });

  const genesisIndexValid = genesis.index === 0;
  details.push({
    pass: genesisIndexValid,
    label: "Genesis Record Index",
    message: genesisIndexValid
      ? "Genesis record sequence index verified."
      : "Custody log corrupted: Initial record sequence index is invalid.",
  });

  // Verify each record's signature and chain linkage
  for (let i = 0; i < history.length; i++) {
    const record = history[i];
    const officerName = record.data?.full_name || record.actorName || `Officer #${i + 1}`;

    // Index continuity
    const indexValid = record.index === i;
    details.push({
      pass: indexValid,
      label: `Record ${i + 1} Sequence`,
      message: indexValid
        ? `Handover entry #${i + 1} sequence verified.`
        : `Custody log corrupted: Handover entry #${i + 1} is out of sequence.`,
    });

    // Chain linkage (skip genesis — already checked)
    if (i > 0) {
      const prevRecord = history[i - 1];
      const linkValid = record.previous_signature === prevRecord.signature;
      details.push({
        pass: linkValid,
        label: `Record ${i + 1} Handover Link`,
        message: linkValid
          ? `Handover #${i + 1} correctly linked to preceding officer seal.`
          : `Custody chain broken: Handover #${i + 1} seal does not match preceding record.`,
      });
    }

    // ECDSA signature verification
    try {
      if (!record.public_stamp) {
        details.push({
          pass: false,
          label: `Record ${i + 1} Digital Stamp (${officerName})`,
          message: `Missing digital signature: Handover entry #${i + 1} lacks an official officer key.`,
        });
        continue;
      }
      const publicKey = await importPublicKey(record.public_stamp);
      const sigValid = await verifySignature(record, publicKey);
      details.push({
        pass: sigValid,
        label: `Record ${i + 1} Digital Stamp (${officerName})`,
        message: sigValid
          ? `Officer digital signature verified authentic (${officerName}).`
          : `Digital signature invalid: Signature seal for ${officerName} has been tampered with or forged.`,
      });
    } catch (err) {
      details.push({
        pass: false,
        label: `Record ${i + 1} Digital Stamp (${officerName})`,
        message: `Signature verification error for ${officerName}: Official digital stamp key is unreadable or corrupted.`,
      });
    }
  }

  return details;
}

/* ── Public API ─────────────────────────────────────────── */

/**
 * Execute dual-pass judicial verification on a .proof container.
 *
 * @param passport - The parsed passport.json from the container.
 * @param mediaFile - The extracted media file.
 * @param onProgress - Optional progress callback for Pass 1 hashing.
 * @returns Comprehensive verification result.
 */
export async function verifyProof(
  passport: Passport,
  mediaFile: File,
  onProgress?: (percent: number) => void
): Promise<VerificationResult> {
  const pass1Details = await verifyPass1(passport, mediaFile, onProgress);
  const pass2Details = await verifyPass2(passport);

  const pass1 = pass1Details.every((d) => d.pass);
  const pass2 = pass2Details.every((d) => d.pass);

  return {
    pass1,
    pass2,
    overall: pass1 && pass2,
    details: [...pass1Details, ...pass2Details],
  };
}

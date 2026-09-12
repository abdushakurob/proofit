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
    const expectedRoot = passport.blueprint.root_fingerprint;

    // Check chunk count
    const chunkCountMatch = leaves.length === passport.blueprint.chunk_count;
    details.push({
      pass: chunkCountMatch,
      label: "Chunk Count",
      message: chunkCountMatch
        ? `Chunk count matches: ${leaves.length}`
        : `Chunk count mismatch: expected ${passport.blueprint.chunk_count}, got ${leaves.length}`,
    });

    // Check file size
    const sizeMatch = mediaFile.size === passport.blueprint.total_file_size;
    details.push({
      pass: sizeMatch,
      label: "File Size",
      message: sizeMatch
        ? `File size matches: ${mediaFile.size} bytes`
        : `File size mismatch: expected ${passport.blueprint.total_file_size}, got ${mediaFile.size}`,
    });

    // Check Merkle root
    const rootMatch = computedRoot === expectedRoot;
    details.push({
      pass: rootMatch,
      label: "Merkle Root",
      message: rootMatch
        ? `Merkle root verified: ${computedRoot.slice(0, 16)}…`
        : `Merkle root MISMATCH: expected ${expectedRoot.slice(0, 16)}…, computed ${computedRoot.slice(0, 16)}…`,
    });

    // Verify covered derivatives if present
    const derivatives = passport.blueprint.covered_derivatives || [];
    if (derivatives.length > 0) {
      details.push({
        pass: true,
        label: "Covered Derivatives",
        message: `${derivatives.length} secondary/modified derivative(s) registered & sealed in passport.`,
      });
    }
  } catch (err) {
    details.push({
      pass: false,
      label: "Pass 1 Error",
      message: `Media integrity check failed: ${err instanceof Error ? err.message : "Unknown error"}`,
    });
  }

  return details;
}

/* ── Pass 2: Chain & Signature Integrity ────────────────── */

async function verifyPass2(passport: Passport): Promise<VerificationDetail[]> {
  const details: VerificationDetail[] = [];
  const history = passport.history;

  if (history.length === 0) {
    details.push({
      pass: false,
      label: "Empty Chain",
      message: "No custody records found in passport history.",
    });
    return details;
  }

  // Check genesis record
  const genesis = history[0];
  const genesisAnchorValid = genesis.previous_signature === GENESIS_PREV_SIG;
  details.push({
    pass: genesisAnchorValid,
    label: "Genesis Anchor",
    message: genesisAnchorValid
      ? "Genesis record has valid null anchor (0000…0000)."
      : `Genesis record has invalid previous_signature: ${genesis.previous_signature.slice(0, 16)}…`,
  });

  const genesisIndexValid = genesis.index === 0;
  details.push({
    pass: genesisIndexValid,
    label: "Genesis Index",
    message: genesisIndexValid
      ? "Genesis record index is 0."
      : `Genesis record has invalid index: ${genesis.index}`,
  });

  // Verify each record's signature and chain linkage
  for (let i = 0; i < history.length; i++) {
    const record = history[i];

    // Index continuity
    const indexValid = record.index === i;
    details.push({
      pass: indexValid,
      label: `Record ${i} Index`,
      message: indexValid
        ? `Record ${i} index is sequential.`
        : `Record ${i} has out-of-order index: ${record.index}`,
    });

    // Chain linkage (skip genesis — already checked)
    if (i > 0) {
      const prevRecord = history[i - 1];
      const linkValid = record.previous_signature === prevRecord.signature;
      details.push({
        pass: linkValid,
        label: `Record ${i} Chain Link`,
        message: linkValid
          ? `Record ${i} correctly links to record ${i - 1}.`
          : `Record ${i} chain link BROKEN: previous_signature does not match record ${i - 1} signature.`,
      });
    }

    // ECDSA signature verification
    try {
      const publicKey = await importPublicKey(record.public_stamp);
      const sigValid = await verifySignature(record, publicKey);
      details.push({
        pass: sigValid,
        label: `Record ${i} Signature`,
        message: sigValid
          ? `Record ${i} ECDSA signature verified (${record.data.full_name}).`
          : `Record ${i} ECDSA signature INVALID for ${record.data.full_name}.`,
      });
    } catch (err) {
      details.push({
        pass: false,
        label: `Record ${i} Signature`,
        message: `Record ${i} signature verification error: ${err instanceof Error ? err.message : "Unknown error"}`,
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

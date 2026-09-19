import { computeMerkleRoot } from "@/modules/hasher/merkle";
import { appendHandover } from "@/modules/ledger/append";
import type { Passport, OfficerProfile, CoveredDerivative } from "@/types";

const CHUNK_SIZE = 2 * 1024 * 1024; // 2 MiB

/**
 * Hash a file in 2MB chunks and compute its Merkle root.
 * (Inline version — does not use the Web Worker, suitable for
 * smaller derivative files or when progress reporting is not needed.)
 */
async function hashFileToLeaves(file: File): Promise<string[]> {
  const leaves: string[] = [];
  let offset = 0;

  while (offset < file.size) {
    const end = Math.min(offset + CHUNK_SIZE, file.size);
    const slice = file.slice(offset, end);
    const buffer = await slice.arrayBuffer();
    const hash = await crypto.subtle.digest("SHA-256", buffer);
    const hex = Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    leaves.push(hex);
    offset = end;
  }

  return leaves;
}

/**
 * Link a derivative (redacted) file to the evidence passport.
 *
 * 1. Hash the derivative file → compute Merkle root.
 * 2. Append to passport.blueprint.covered_derivatives.
 * 3. Append an audit custody entry noting the derivative action.
 *
 * @param passport       - Current passport state.
 * @param derivativeFile - The redacted/masked derivative file.
 * @param reason         - Reason for derivative creation (e.g., "Privacy redaction — victim faces blurred").
 * @param officer        - The officer performing the redaction.
 * @param privateKey     - Officer's ECDSA private key (RAM only).
 * @param publicKey      - Officer's ECDSA public key.
 * @returns Updated passport with derivative linked.
 */
export async function linkDerivative(
  passport: Passport,
  derivativeFile: File,
  reason: string,
  officer: OfficerProfile,
  privateKey: CryptoKey,
  publicKey: CryptoKey,
  redactionType: string = "Privacy Redaction",
  tags: string[] = ["PII Mask"],
  similarityPercentage: number = 88.0
): Promise<Passport> {
  // 1. Compute derivative Merkle root
  const leaves = await hashFileToLeaves(derivativeFile);
  const fingerprint = await computeMerkleRoot(leaves);

  // 2. Build derivative entry with similarity % and tags
  const derivativeEntry: CoveredDerivative = {
    filename: derivativeFile.name,
    fingerprint,
    reason,
    linked_at: new Date().toISOString(),
    redaction_type: redactionType,
    tags,
    original_hash: passport.blueprint.root_fingerprint,
    similarity_percentage: similarityPercentage,
  };

  // 3. Append to blueprint.covered_derivatives
  const updatedBlueprint = {
    ...passport.blueprint,
    covered_derivatives: [
      ...(passport.blueprint.covered_derivatives ?? []),
      derivativeEntry,
    ],
  };

  // 4. Append audit chain entry
  const tagStr = tags.length > 0 ? ` [Tags: ${tags.join(", ")}]` : "";
  const auditNote = `DERIVATIVE LINKED: ${derivativeFile.name} (${redactionType}${tagStr}, ${similarityPercentage}% Intact) — ${reason} — Fingerprint: ${fingerprint.slice(0, 16)}…`;
  const updatedPassport = await appendHandover(
    { ...passport, blueprint: updatedBlueprint },
    officer,
    auditNote,
    privateKey,
    publicKey
  );

  return updatedPassport;
}

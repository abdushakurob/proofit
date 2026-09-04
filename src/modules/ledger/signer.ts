import canonicalizeJson from "canonicalize";
import type { CustodyRecord } from "@/types";

/* ── Helpers ────────────────────────────────────────────── */

function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuf(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

/* ── Canonicalization ───────────────────────────────────── */

/**
 * Build the signable payload from a custody record.
 * We canonicalize everything EXCEPT the signature field itself.
 */
function buildSignablePayload(record: CustodyRecord): string {
  const { signature: _sig, ...rest } = record;
  void _sig;
  const canonical = canonicalizeJson(rest);
  if (!canonical) throw new Error("Canonicalization failed");
  return canonical;
}

/* ── Signing ────────────────────────────────────────────── */

/**
 * Sign a custody record with the officer's ECDSA P-256 private key.
 *
 * 1. Strip the `signature` field from the record.
 * 2. Canonicalize via RFC 8785.
 * 3. UTF-8 encode → SHA-256 digest → ECDSA sign.
 * 4. Return Base64-encoded signature.
 */
export async function signRecord(
  record: Omit<CustodyRecord, "signature">,
  privateKey: CryptoKey
): Promise<string> {
  const payload = canonicalizeJson(record);
  if (!payload) throw new Error("Canonicalization failed");

  const data = new TextEncoder().encode(payload);
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    data
  );

  return bufToBase64(sig);
}

/**
 * Verify an ECDSA signature on a custody record.
 *
 * Reconstructs the canonical payload (excluding `signature`),
 * then verifies using the provided public key.
 */
export async function verifySignature(
  record: CustodyRecord,
  publicKey: CryptoKey
): Promise<boolean> {
  const payload = buildSignablePayload(record);
  const data = new TextEncoder().encode(payload);
  const sigBuf = base64ToBuf(record.signature);

  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    sigBuf,
    data
  );
}

/**
 * Re-export the canonicalize function for external use.
 */
export { canonicalizeJson as canonicalize };

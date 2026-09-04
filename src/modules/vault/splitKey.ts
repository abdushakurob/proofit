import { get, set } from "idb-keyval";

const PBKDF2_ITERATIONS = 200_000;
const KEY_BYTES = 32;

/* ── Helpers ────────────────────────────────────────────── */

function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

function xor(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] ^ b[i];
  }
  return result;
}

/* ── Factor A: MiniKey in IndexedDB ─────────────────────── */

/**
 * Generate or retrieve Factor A (K_A) — a 32-byte random blob
 * stored in origin-isolated IndexedDB.
 */
export async function getOrCreateMiniKey(badgeId: string): Promise<Uint8Array> {
  const dbKey = `proofit_minikey_${badgeId}`;
  const existing = await get<Uint8Array>(dbKey);
  if (existing) return new Uint8Array(existing);

  const fresh = crypto.getRandomValues(new Uint8Array(KEY_BYTES));
  await set(dbKey, fresh);
  return fresh;
}

/**
 * Check whether a MiniKey exists for the given badge ID
 * (i.e., whether this officer has been enrolled on this device).
 */
export async function hasMiniKey(badgeId: string): Promise<boolean> {
  const dbKey = `proofit_minikey_${badgeId}`;
  const existing = await get<Uint8Array>(dbKey);
  return existing !== undefined;
}

/* ── Factor B: PBKDF2 from Password ────────────────────── */

/**
 * Derive Factor B (K_B) from the officer's master password
 * using PBKDF2-HMAC-SHA256 with 200,000 iterations.
 */
export async function deriveFactorB(
  password: string,
  badgeId: string
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const salt = enc.encode(`proofit_salt_${badgeId}`);
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITERATIONS },
    keyMaterial,
    KEY_BYTES * 8
  );

  return new Uint8Array(derived);
}

/* ── Keypair Synthesis ──────────────────────────────────── */

/**
 * Synthesise K_seed = K_A ⊕ K_B, then deterministically
 * derive an ECDSA P-256 signing keypair.
 *
 * The private key is imported as **non-extractable** so it
 * can never be serialised out of volatile RAM.
 */
export async function synthesizeKeypair(
  kA: Uint8Array,
  kB: Uint8Array
): Promise<CryptoKeyPair> {
  const kSeed = xor(kA, kB);

  // Derive a deterministic 32-byte private scalar from K_seed
  // via SHA-256 to ensure valid curve scalar range
  const privateScalar = await crypto.subtle.digest(
    "SHA-256",
    kSeed as unknown as BufferSource
  );

  // Build a PKCS#8 wrapper for the raw 32-byte P-256 private key.
  // The PKCS#8 ASN.1 prefix for P-256 is 36 bytes.
  const pkcs8Prefix = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const pkcs8 = new Uint8Array(pkcs8Prefix.length + 32);
  pkcs8.set(pkcs8Prefix, 0);
  pkcs8.set(new Uint8Array(privateScalar), pkcs8Prefix.length);

  // Import private key as non-extractable
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8 as unknown as BufferSource,
    { name: "ECDSA", namedCurve: "P-256" },
    false, // non-extractable
    ["sign"]
  );

  // Export JWK to extract the public key, then re-import as public-only
  // We need the public key for verification; export the private as JWK temporarily
  const privateKeyExtractable = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8 as unknown as BufferSource,
    { name: "ECDSA", namedCurve: "P-256" },
    true, // extractable only for public key extraction
    ["sign"]
  );
  const jwk = await crypto.subtle.exportKey("jwk", privateKeyExtractable);
  // Remove private component to create public-only JWK
  delete jwk.d;
  jwk.key_ops = ["verify"];

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"]
  );

  return { privateKey, publicKey };
}

/**
 * Option B: Derive a 100% deterministic ECDSA P-256 keypair from
 * the officer's Master Password + badgeId salt.
 *
 * This keypair is identical across all devices where the officer
 * enters their Master Password. Private key remains non-extractable in RAM.
 */
export async function deriveDeterministicKeypair(
  badgeId: string,
  password: string
): Promise<CryptoKeyPair> {
  const kB = await deriveFactorB(password, badgeId);
  const zeroA = new Uint8Array(KEY_BYTES);
  return synthesizeKeypair(zeroA, kB);
}

/* ── Public Key Export ──────────────────────────────────── */

/**
 * Export the raw public key as a hex string (the "public stamp"
 * stored alongside each custody record for independent verification).
 */
export async function exportPublicStamp(publicKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", publicKey);
  return bufToHex(raw);
}

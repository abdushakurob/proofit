import { get, set, keys } from "idb-keyval";
import type { OfficerProfile } from "@/types";

const PBKDF2_ITERATIONS = 200_000;
const IV_BYTES = 12;
const PROFILE_PREFIX = "proofit_profile_";

/* ── Key Derivation ─────────────────────────────────────── */

async function deriveProfileKey(
  password: string,
  badgeId: string
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: enc.encode(`profile_salt_${badgeId}`),
      iterations: PBKDF2_ITERATIONS,
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/* ── Encrypt & Decrypt ──────────────────────────────────── */

async function encryptPayload(
  plaintext: string,
  key: CryptoKey
): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );

  // Prepend IV to ciphertext: [12-byte IV | ciphertext]
  const result = new Uint8Array(IV_BYTES + ciphertext.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(ciphertext), IV_BYTES);
  return result;
}

async function decryptPayload(
  encrypted: Uint8Array,
  key: CryptoKey
): Promise<string> {
  const iv = encrypted.slice(0, IV_BYTES);
  const ciphertext = encrypted.slice(IV_BYTES);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(plaintext);
}

/* ── Public API ─────────────────────────────────────────── */

/**
 * Save an officer profile encrypted in IndexedDB.
 */
export async function saveProfile(
  badgeId: string,
  password: string,
  profile: OfficerProfile
): Promise<void> {
  const key = await deriveProfileKey(password, badgeId);
  const encrypted = await encryptPayload(JSON.stringify(profile), key);
  await set(`${PROFILE_PREFIX}${badgeId}`, encrypted);
}

/**
 * Load and decrypt an officer profile from IndexedDB.
 * Throws if the password is wrong (AES-GCM auth tag mismatch).
 */
export async function loadProfile(
  badgeId: string,
  password: string
): Promise<OfficerProfile> {
  const encrypted = await get<Uint8Array>(`${PROFILE_PREFIX}${badgeId}`);
  if (!encrypted) {
    throw new Error(`No profile found for badge ID: ${badgeId}`);
  }

  const key = await deriveProfileKey(password, badgeId);
  const json = await decryptPayload(new Uint8Array(encrypted), key);
  return JSON.parse(json) as OfficerProfile;
}

/**
 * Check if a profile exists for the given badge ID.
 */
export async function hasProfile(badgeId: string): Promise<boolean> {
  const existing = await get<Uint8Array>(`${PROFILE_PREFIX}${badgeId}`);
  return existing !== undefined;
}

/**
 * List all enrolled badge IDs on this device.
 */
export async function listEnrolledBadges(): Promise<string[]> {
  const allKeys = await keys();
  return (allKeys as string[])
    .filter((k) => typeof k === "string" && k.startsWith(PROFILE_PREFIX))
    .map((k) => k.slice(PROFILE_PREFIX.length));
}

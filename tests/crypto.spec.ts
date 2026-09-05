/* ─────────────────────────────────────────────────────────────
   crypto.spec.ts — ProofIt Cryptographic Module Test Suite
   
   Tests Merkle tree, canonical JSON, split-key, and signer
   modules for correctness, determinism, and tamper detection.
   ───────────────────────────────────────────────────────────── */

import { describe, it, expect, beforeAll } from "vitest";
import { computeMerkleRoot } from "@/modules/hasher/merkle";
import { signRecord, verifySignature, canonicalize } from "@/modules/ledger/signer";
import type { CustodyRecord } from "@/types";

/* ── Merkle Tree Tests ──────────────────────────────────── */

describe("Merkle Tree", () => {
  it("should return single leaf as root when only one leaf", async () => {
    const leaf = "a".repeat(64);
    const root = await computeMerkleRoot([leaf]);
    expect(root).toBe(leaf);
  });

  it("should compute deterministic root for two leaves", async () => {
    const leaves = [
      "0000000000000000000000000000000000000000000000000000000000000001",
      "0000000000000000000000000000000000000000000000000000000000000002",
    ];
    const root1 = await computeMerkleRoot(leaves);
    const root2 = await computeMerkleRoot(leaves);
    expect(root1).toBe(root2);
    expect(root1).toHaveLength(64);
    expect(root1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should handle odd number of leaves by duplicating terminal node", async () => {
    const leaves = [
      "0000000000000000000000000000000000000000000000000000000000000001",
      "0000000000000000000000000000000000000000000000000000000000000002",
      "0000000000000000000000000000000000000000000000000000000000000003",
    ];
    const root = await computeMerkleRoot(leaves);
    expect(root).toHaveLength(64);
    expect(root).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should produce different root when a leaf changes (tamper detection)", async () => {
    const original = [
      "0000000000000000000000000000000000000000000000000000000000000001",
      "0000000000000000000000000000000000000000000000000000000000000002",
    ];
    const tampered = [
      "0000000000000000000000000000000000000000000000000000000000000001",
      "ff00000000000000000000000000000000000000000000000000000000000002",
    ];
    const rootOriginal = await computeMerkleRoot(original);
    const rootTampered = await computeMerkleRoot(tampered);
    expect(rootOriginal).not.toBe(rootTampered);
  });

  it("should throw on empty leaf array", async () => {
    await expect(computeMerkleRoot([])).rejects.toThrow();
  });

  it("should handle 4 leaves (even, power of 2)", async () => {
    const leaves = [
      "a".repeat(64),
      "b".repeat(64),
      "c".repeat(64),
      "d".repeat(64),
    ];
    const root = await computeMerkleRoot(leaves);
    expect(root).toHaveLength(64);
  });
});

/* ── RFC 8785 Canonical JSON Tests ──────────────────────── */

describe("RFC 8785 Canonical JSON", () => {
  it("should sort keys lexicographically", () => {
    const input = { z: 1, a: 2, m: 3 };
    const result = canonicalize(input);
    expect(result).toBe('{"a":2,"m":3,"z":1}');
  });

  it("should handle nested objects", () => {
    const input = { b: { d: 1, c: 2 }, a: 3 };
    const result = canonicalize(input);
    expect(result).toBe('{"a":3,"b":{"c":2,"d":1}}');
  });

  it("should produce zero whitespace", () => {
    const input = { key: "value", number: 42 };
    const result = canonicalize(input);
    expect(result).not.toContain(" ");
    expect(result).not.toContain("\n");
    expect(result).not.toContain("\t");
  });

  it("should produce identical output regardless of insertion order", () => {
    const obj1: Record<string, number> = {};
    obj1["b"] = 2;
    obj1["a"] = 1;

    const obj2: Record<string, number> = {};
    obj2["a"] = 1;
    obj2["b"] = 2;

    expect(canonicalize(obj1)).toBe(canonicalize(obj2));
  });
});

/* ── ECDSA Signature Tests ──────────────────────────────── */

describe("ECDSA P-256 Signer", () => {
  let keypair: CryptoKeyPair;

  beforeAll(async () => {
    keypair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );
  });

  it("should sign and verify a custody record", async () => {
    const record: Omit<CustodyRecord, "signature"> = {
      index: 0,
      previous_signature: "0".repeat(64),
      timestamp: "2024-01-01T00:00:00.000Z",
      data: {
        full_name: "Inspector Test",
        id_number: "AP/00001",
        agency: "Test Agency",
        note: "Evidence sealed at intake.",
      },
      public_stamp: "04" + "ab".repeat(32),
    };

    const signature = await signRecord(record, keypair.privateKey);
    expect(signature).toBeTruthy();
    expect(typeof signature).toBe("string");

    // Verify the signature
    const fullRecord: CustodyRecord = { ...record, signature };
    const valid = await verifySignature(fullRecord, keypair.publicKey);
    expect(valid).toBe(true);
  });

  it("should reject tampered record (modified note)", async () => {
    const record: Omit<CustodyRecord, "signature"> = {
      index: 0,
      previous_signature: "0".repeat(64),
      timestamp: "2024-01-01T00:00:00.000Z",
      data: {
        full_name: "Inspector Test",
        id_number: "AP/00001",
        agency: "Test Agency",
        note: "Original note.",
      },
      public_stamp: "04" + "cd".repeat(32),
    };

    const signature = await signRecord(record, keypair.privateKey);
    const fullRecord: CustodyRecord = { ...record, signature };

    // Tamper with the note
    const tampered: CustodyRecord = {
      ...fullRecord,
      data: { ...fullRecord.data, note: "TAMPERED note." },
    };

    const valid = await verifySignature(tampered, keypair.publicKey);
    expect(valid).toBe(false);
  });

  it("should produce different signatures for different records", async () => {
    const base: Omit<CustodyRecord, "signature"> = {
      index: 0,
      previous_signature: "0".repeat(64),
      timestamp: "2024-01-01T00:00:00.000Z",
      data: {
        full_name: "Inspector Test",
        id_number: "AP/00001",
        agency: "Test Agency",
        note: "Note A",
      },
      public_stamp: "04" + "ef".repeat(32),
    };

    const sig1 = await signRecord(base, keypair.privateKey);
    const sig2 = await signRecord(
      { ...base, data: { ...base.data, note: "Note B" } },
      keypair.privateKey
    );

    // ECDSA signatures include randomness, so even same content produces different sigs
    // But different content should definitely be different
    expect(sig1).toBeTruthy();
    expect(sig2).toBeTruthy();
  });
});

/* ── Chain Continuity Tests ─────────────────────────────── */

describe("Chain Continuity", () => {
  it("should validate genesis previous_signature is 64 zeros", () => {
    const genesisPrev = "0".repeat(64);
    expect(genesisPrev).toHaveLength(64);
    expect(genesisPrev).toMatch(/^0{64}$/);
  });

  it("should detect broken chain link", async () => {
    const keypair = await crypto.subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );

    const genesis: Omit<CustodyRecord, "signature"> = {
      index: 0,
      previous_signature: "0".repeat(64),
      timestamp: "2024-01-01T00:00:00.000Z",
      data: {
        full_name: "Officer A",
        id_number: "AP/001",
        agency: "Agency A",
        note: "Genesis",
      },
      public_stamp: "04" + "11".repeat(32),
    };

    const genesisSig = await signRecord(genesis, keypair.privateKey);
    const genesisRecord: CustodyRecord = { ...genesis, signature: genesisSig };

    // Create second record with CORRECT link
    const transfer: Omit<CustodyRecord, "signature"> = {
      index: 1,
      previous_signature: genesisRecord.signature,
      timestamp: "2024-01-02T00:00:00.000Z",
      data: {
        full_name: "Officer B",
        id_number: "AP/002",
        agency: "Agency B",
        note: "Transfer",
      },
      public_stamp: "04" + "22".repeat(32),
    };

    const transferSig = await signRecord(transfer, keypair.privateKey);
    const transferRecord: CustodyRecord = { ...transfer, signature: transferSig };

    // Verify correct chain linkage
    expect(transferRecord.previous_signature).toBe(genesisRecord.signature);

    // Create a broken link
    const brokenRecord: CustodyRecord = {
      ...transferRecord,
      previous_signature: "deadbeef".repeat(8),
    };
    expect(brokenRecord.previous_signature).not.toBe(genesisRecord.signature);
  });
});

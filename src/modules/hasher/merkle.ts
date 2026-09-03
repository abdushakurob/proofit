/**
 * Convert a hex string to Uint8Array (32 bytes for SHA-256).
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert an ArrayBuffer to a 64-char lowercase hex string.
 */
function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

/**
 * Hash two concatenated 32-byte nodes: SHA-256(left || right).
 */
async function hashPair(left: Uint8Array, right: Uint8Array): Promise<Uint8Array> {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left, 0);
  combined.set(right, left.length);
  const digest = await crypto.subtle.digest("SHA-256", combined);
  return new Uint8Array(digest);
}

/**
 * Compute the Merkle root from an array of hex-encoded leaf hashes.
 *
 * Parity rule: If a layer has an odd number of nodes, the last
 * node is duplicated before pairwise reduction.
 *
 * @param leafHexes - Array of 64-char lowercase hex SHA-256 digests.
 * @returns 64-char lowercase hex Merkle root.
 */
export async function computeMerkleRoot(leafHexes: string[]): Promise<string> {
  if (leafHexes.length === 0) {
    throw new Error("Cannot compute Merkle root from zero leaves");
  }

  // Single leaf — the root is the leaf itself
  if (leafHexes.length === 1) {
    return leafHexes[0];
  }

  // Convert hex leaves to byte arrays
  let layer: Uint8Array[] = leafHexes.map(hexToBytes);

  // Reduce layer by layer until we have a single root node
  while (layer.length > 1) {
    // Parity: duplicate terminal node if odd count
    if (layer.length % 2 !== 0) {
      layer.push(layer[layer.length - 1]);
    }

    const nextLayer: Uint8Array[] = [];
    for (let i = 0; i < layer.length; i += 2) {
      const parent = await hashPair(layer[i], layer[i + 1]);
      nextLayer.push(parent);
    }
    layer = nextLayer;
  }

  return bufToHex(layer[0].buffer as ArrayBuffer);
}

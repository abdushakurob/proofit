import { zipSync, strToU8 } from "fflate";
import type { Passport } from "@/types";

/**
 * Pack a .proof container (uncompressed ZIP).
 *
 * @param passport  - The complete passport.json document.
 * @param mediaFile - The original evidence media file.
 * @param derivatives - Optional derivative (redacted) files.
 * @returns A downloadable Blob with MIME type application/zip.
 */
export async function packProof(
  passport: Passport,
  mediaFile: File,
  derivatives: File[] = []
): Promise<Blob> {
  // Build the file map for the ZIP container
  const files: Record<string, Uint8Array> = {};

  // 1. passport.json — canonical JSON with 2-space indent for readability
  const passportJson = JSON.stringify(passport, null, 2);
  files["passport.json"] = strToU8(passportJson);

  // 2. Original media file — bit-for-bit, store mode (no compression)
  const mediaBuffer = await mediaFile.arrayBuffer();
  files[`media/${mediaFile.name}`] = new Uint8Array(mediaBuffer);

  // 3. Optional derivative files
  for (const derivative of derivatives) {
    const derivBuf = await derivative.arrayBuffer();
    files[`derivatives/${derivative.name}`] = new Uint8Array(derivBuf);
  }

  // Create store-mode ZIP (level 0 = no compression)
  const zipped = zipSync(files, { level: 0 });
  return new Blob([zipped], { type: "application/zip" });
}

/**
 * Trigger a browser download of a .proof container.
 */
export function downloadProof(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".proof") ? filename : `${filename}.proof`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generate a unique, non-colliding .proof filename with case ID, officer badge ID, and timestamp.
 */
export function generateProofFileName(caseId: string, officerBadgeId?: string): string {
  const cleanCase = (caseId || "CASE").replace(/[^a-zA-Z0-9_-]/g, "_");
  const cleanBadge = (officerBadgeId || "OFFICER").replace(/[^a-zA-Z0-9_-]/g, "_");
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const mins = String(now.getMinutes()).padStart(2, "0");
  const secs = String(now.getSeconds()).padStart(2, "0");

  return `${cleanCase}_${cleanBadge}_${year}${month}${day}_${hours}${mins}${secs}.proof`;
}

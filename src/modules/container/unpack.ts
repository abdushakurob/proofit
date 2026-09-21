import { unzipSync, strFromU8 } from "fflate";
import type { Passport } from "@/types";
import { getMimeTypeFromName } from "@/types";

export interface UnpackResult {
  passport: Passport;
  mediaFile: File;
  derivatives: File[];
}

/**
 * Unpack a .proof container and extract its contents.
 *
 * @param proofBlob - The .proof file as a Blob or File.
 * @returns Parsed passport, original media File, and derivative Files.
 */
export async function unpackProof(proofBlob: Blob): Promise<UnpackResult> {
  const buffer = await proofBlob.arrayBuffer();
  let unzipped: Record<string, Uint8Array>;

  try {
    unzipped = unzipSync(new Uint8Array(buffer));
  } catch (zipErr) {
    throw new Error("Container File Corrupted: The archive structure is damaged or unreadable.");
  }

  // 1. Extract passport.json safely
  const passportEntry = unzipped["passport.json"];
  let passport: Passport;

  if (!passportEntry) {
    passport = {
      format_version: "1.0",
      case_id: "TAMPERED-MANIFEST",
      blueprint: {
        chunk_size_bytes: 2097152,
        total_file_size: 0,
        chunk_count: 0,
        root_fingerprint: "0".repeat(64),
        original_filename: "Tampered_Manifest_Evidence",
      },
      history: [],
    };
  } else {
    try {
      const passportJson = strFromU8(passportEntry);
      passport = JSON.parse(passportJson);
    } catch (jsonErr) {
      passport = {
        format_version: "1.0",
        case_id: "TAMPERED-MANIFEST",
        blueprint: {
          chunk_size_bytes: 2097152,
          total_file_size: 0,
          chunk_count: 0,
          root_fingerprint: "0".repeat(64),
          original_filename: "Tampered_Manifest_Evidence",
        },
        history: [],
      };
    }
  }

  // 2. Extract media file(s) — expect in media/ or root ZIP entries
  let mediaFile: File | null = null;
  const derivatives: File[] = [];

  for (const [path, data] of Object.entries(unzipped)) {
    if (path === "passport.json" || path.endsWith("/")) continue;

    if (path.startsWith("media/")) {
      const filename = path.slice("media/".length);
      if (filename && !filename.endsWith("/")) {
        const mimeType = getMimeTypeFromName(filename);
        mediaFile = new File([new Uint8Array(data)], filename, { type: mimeType });
      }
    } else if (path.startsWith("derivatives/")) {
      const filename = path.slice("derivatives/".length);
      if (filename && !filename.endsWith("/")) {
        const mimeType = getMimeTypeFromName(filename);
        derivatives.push(new File([new Uint8Array(data)], filename, { type: mimeType }));
      }
    }
  }

  // Fallback: If no media/ folder entry, grab any non-passport payload file in the ZIP archive
  if (!mediaFile) {
    for (const [path, data] of Object.entries(unzipped)) {
      if (path === "passport.json" || path.endsWith("/")) continue;
      const cleanName = path.split("/").pop() || "evidence_payload";
      const mimeType = getMimeTypeFromName(cleanName);
      mediaFile = new File([new Uint8Array(data)], cleanName, { type: mimeType });
      break;
    }
  }

  if (!mediaFile) {
    mediaFile = new File([new Uint8Array(0)], "Tampered_Payload.bin", { type: "application/octet-stream" });
  }

  return { passport, mediaFile, derivatives };
}

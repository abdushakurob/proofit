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
  const unzipped = unzipSync(new Uint8Array(buffer));

  // 1. Extract passport.json
  const passportEntry = unzipped["passport.json"];
  if (!passportEntry) {
    throw new Error("Invalid .proof container: missing passport.json");
  }
  const passportJson = strFromU8(passportEntry);
  const passport: Passport = JSON.parse(passportJson);

  // 2. Extract media file(s) — expect exactly one in media/
  let mediaFile: File | null = null;
  const derivatives: File[] = [];

  for (const [path, data] of Object.entries(unzipped)) {
    if (path === "passport.json") continue;

    if (path.startsWith("media/")) {
      const filename = path.slice("media/".length);
      if (filename) {
        const mimeType = getMimeTypeFromName(filename);
        mediaFile = new File([data], filename, { type: mimeType });
      }
    } else if (path.startsWith("derivatives/")) {
      const filename = path.slice("derivatives/".length);
      if (filename) {
        const mimeType = getMimeTypeFromName(filename);
        derivatives.push(new File([data], filename, { type: mimeType }));
      }
    }
  }

  if (!mediaFile) {
    throw new Error("Invalid .proof container: missing media file");
  }

  return { passport, mediaFile, derivatives };
}

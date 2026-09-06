const CHUNK_SIZE = 2 * 1024 * 1024;


/**
 * Convert an ArrayBuffer to a 64-character lowercase hex string.
 */
function bufToHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

self.onmessage = async (e: MessageEvent) => {
  try {
    const file: File = e.data.file;
    const chunkSize: number = e.data.chunkSize ?? CHUNK_SIZE;
    const totalBytes = file.size;
    const leaves: string[] = [];
    let bytesRead = 0;

    while (bytesRead < totalBytes) {
      const end = Math.min(bytesRead + chunkSize, totalBytes);
      const slice = file.slice(bytesRead, end);
      const buffer = await slice.arrayBuffer();
      const hashBuf = await crypto.subtle.digest("SHA-256", buffer);
      leaves.push(bufToHex(hashBuf));

      bytesRead = end;

      // Post progress update to main thread
      self.postMessage({
        type: "progress",
        bytesRead,
        totalBytes,
        percent: Math.round((bytesRead / totalBytes) * 100),
      });
    }

    // Post final leaf array
    self.postMessage({ type: "done", leaves });
  } catch (err) {
    self.postMessage({
      type: "error",
      message: err instanceof Error ? err.message : "Unknown worker error",
    });
  }
};

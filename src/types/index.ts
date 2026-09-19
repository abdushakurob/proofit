/** Officer identity profile stored encrypted in IndexedDB */
export interface OfficerProfile {
  badgeId: string;
  fullName: string;
  idNumber: string;
  agency: string;
  rank?: string;
  nin?: string;
  publicStamp?: string;
}

/** Helper to infer correct MIME type from filename extension */
export function getMimeTypeFromName(filename: string, fallbackType: string = ""): string {
  if (fallbackType && fallbackType !== "application/octet-stream" && fallbackType !== "") {
    return fallbackType;
  }
  const ext = filename.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'gif': return 'image/gif';
    case 'svg': return 'image/svg+xml';
    case 'bmp': return 'image/bmp';
    case 'mp4': return 'video/mp4';
    case 'webm': return 'video/webm';
    case 'mov': return 'video/quicktime';
    case 'mp3': return 'audio/mpeg';
    case 'wav': return 'audio/wav';
    case 'pdf': return 'application/pdf';
    case 'txt': return 'text/plain';
    case 'csv': return 'text/csv';
    case 'json': return 'application/json';
    default: return fallbackType || 'application/octet-stream';
  }
}

/** Derivative file entry linked to the original evidence */
export interface CoveredDerivative {
  filename: string;
  fingerprint: string; // 64-char lowercase hex SHA-256 Merkle root
  reason: string;
  linked_at: string; // ISO 8601 date-time
  redaction_type?: string;
  tags?: string[];
  original_hash?: string;
  similarity_percentage?: number;
}

/** Blueprint section of passport.json — describes the evidence file */
export interface Blueprint {
  chunk_size_bytes: 2097152;
  total_file_size: number;
  chunk_count: number;
  root_fingerprint: string; // 64-char lowercase hex Merkle root
  original_filename: string;
  covered_derivatives?: CoveredDerivative[];
}

/** A single entry in the custody chain history */
export interface CustodyRecord {
  index: number;
  previous_signature: string;
  timestamp: string; // ISO 8601 date-time
  data: {
    full_name: string;
    id_number: string;
    agency: string;
    note: string;
  };
  public_stamp: string; // Hex-encoded raw ECDSA public key
  signature: string; // Base64-encoded ECDSA signature

  // Flexible fields for custody visualization & ingestion
  evidenceId?: string;
  sequenceNumber?: number;
  actorName?: string;
  actorBadgeId?: string;
  action?: string;
  notes?: string;
  publicStamp?: string;
}

/** The complete passport.json document inside a .proof container */
export interface Passport {
  format_version: "1.0";
  case_id: string;
  blueprint: Blueprint;
  history: CustodyRecord[];

  // Optional summary & metadata fields
  evidenceId?: string;
  evidenceMetadata?: {
    evidenceId?: string;
    caseId?: string;
    originalFileName?: string;
    fileType?: string;
    fileSizeBytes?: number;
    merkleRootHex?: string;
    totalChunks?: number;
    chunkSizeBytes?: number;
    sealedAtTimestamp?: string;
    sealedByOfficerBadge?: string;
    deviceModel?: string;
    osVersion?: string;
    gpsLocation?: string;
  };
  derivatives?: any[];
}

/** Result returned by the dual-pass verification engine */
export interface VerificationResult {
  pass1: boolean; // Merkle root matches media file
  pass2: boolean; // Chain signatures & continuity valid
  overall: boolean;
  isValid?: boolean; // Convenience alias for overall
  details: VerificationDetail[];
}

export interface VerificationDetail {
  pass: boolean;
  label: string;
  message: string;
}

/** Messages posted from the hasher Web Worker */
export type HasherWorkerMessage =
  | { type: "progress"; bytesRead: number; totalBytes: number; percent: number }
  | { type: "done"; leaves: string[] }
  | { type: "error"; message: string };

/** Messages sent to the hasher Web Worker */
export interface HasherWorkerInput {
  file: File;
  chunkSize?: number;
}

/** Application mode states */
export type AppMode = "auth" | "dashboard" | "intake" | "handover" | "review" | "derivative";

/** Auth context state */
export interface AuthState {
  officer: OfficerProfile | null;
  keypair: CryptoKeyPair | null;
  publicStamp: string | null;
  isAuthenticated: boolean;
  isUnlocked?: boolean;
  currentOfficer?: OfficerProfile | null;
}

/** Pre-seeded demo officer for evaluation */
export interface DemoOfficer {
  badgeId: string;
  fullName: string;
  idNumber: string;
  agency: string;
  rank: string;
  defaultPassword: string;
}

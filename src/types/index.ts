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

/** Derivative file entry linked to the original evidence */
export interface CoveredDerivative {
  filename: string;
  fingerprint: string; // 64-char lowercase hex SHA-256 Merkle root
  reason: string;
  linked_at: string; // ISO 8601 date-time
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

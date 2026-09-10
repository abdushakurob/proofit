import { signRecord } from "@/modules/ledger/signer";
import { exportPublicStamp } from "@/modules/vault/splitKey";
import type { Passport, CustodyRecord, OfficerProfile } from "@/types";

/**
 * Append a handover custody record to the passport history.
 *
 * @param passport   - Current passport state.
 * @param officer    - The receiving officer's profile.
 * @param note       - Handover transfer note.
 * @param privateKey - Officer's ECDSA private key (RAM only).
 * @param publicKey  - Officer's ECDSA public key.
 * @returns Updated passport with the new history entry appended.
 */
export async function appendHandover(
  passport: Passport,
  officer: OfficerProfile,
  note: string,
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<Passport> {
  const history = passport.history || [];
  const lastEntry = history[history.length - 1];
  const newIndex = history.length;

  // Build the unsigned record
  const unsignedRecord: Omit<CustodyRecord, "signature"> = {
    index: newIndex,
    previous_signature: lastEntry ? lastEntry.signature : "0".repeat(64),
    timestamp: new Date().toISOString(),
    data: {
      full_name: officer.fullName,
      id_number: officer.idNumber,
      agency: officer.agency,
      note,
    },
    public_stamp: await exportPublicStamp(publicKey),
  };

  // Sign the canonical record
  const signature = await signRecord(unsignedRecord, privateKey);

  const signedRecord: CustodyRecord = {
    ...unsignedRecord,
    signature,
  };

  const updatedHistory = [...history, signedRecord];

  return {
    ...passport,
    history: updatedHistory,
  };
}

/**
 * Create the genesis (index 0) custody record for new evidence intake.
 *
 * The genesis record's `previous_signature` is the null anchor:
 * 64 zeros ("0000...0000").
 */
export async function createGenesisRecord(
  officer: OfficerProfile,
  note: string,
  privateKey: CryptoKey,
  publicKey: CryptoKey
): Promise<CustodyRecord> {
  const GENESIS_PREV_SIG = "0".repeat(64);

  const unsignedRecord: Omit<CustodyRecord, "signature"> = {
    index: 0,
    previous_signature: GENESIS_PREV_SIG,
    timestamp: new Date().toISOString(),
    data: {
      full_name: officer.fullName,
      id_number: officer.idNumber,
      agency: officer.agency,
      note,
    },
    public_stamp: await exportPublicStamp(publicKey),
  };

  const signature = await signRecord(unsignedRecord, privateKey);

  return { ...unsignedRecord, signature };
}

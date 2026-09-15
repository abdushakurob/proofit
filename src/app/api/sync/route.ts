import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { evidenceItems, custodyLedger } from "@/db/schema";
import { eq, max } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = await request.json();
    const { items, custodyRecords } = body;

    let syncedCount = 0;

    if (Array.isArray(items)) {
      for (const item of items) {
        await db
          .insert(evidenceItems)
          .values({
            id: item.id || `ev-${Date.now()}`,
            caseId: item.case_id || "case-001",
            evidenceId: item.evidence_id,
            originalFilename: item.original_filename,
            fileType: item.file_type,
            fileSizeBytes: item.file_size_bytes,
            merkleRoot: item.merkle_root,
            sealedAt: item.sealed_at,
            status: "Sealed",
            metadataJson: typeof item.metadata_json === "string" ? item.metadata_json : JSON.stringify(item.metadata_json),
          })
          .onConflictDoNothing();
        syncedCount++;
      }
    }

    if (Array.isArray(custodyRecords)) {
      for (const rec of custodyRecords) {
        const maxSeqRes = await db
          .select({ maxSeq: max(custodyLedger.sequenceNumber) })
          .from(custodyLedger)
          .where(eq(custodyLedger.evidenceId, rec.evidence_id));

        const maxSeq = maxSeqRes[0]?.maxSeq ?? 0;
        const nextSeq = maxSeq + 1;

        await db
          .insert(custodyLedger)
          .values({
            id: rec.id || `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            evidenceId: rec.evidence_id,
            sequenceNumber: nextSeq,
            timestamp: rec.timestamp,
            actorBadgeId: rec.actor_badge_id,
            actorName: rec.actor_name,
            action: rec.action,
            notes: rec.notes,
            canonicalHash: rec.canonical_hash || "hash",
            signature: rec.signature,
            publicStamp: rec.public_stamp,
            syncStatus: "synced_offline",
          })
          .onConflictDoNothing();
        syncedCount++;
      }
    }

    return NextResponse.json({
      message: `Successfully synchronized ${syncedCount} offline records to SQLite DB`,
      syncedCount,
      success: true,
    });
  } catch (error) {
    console.error("Failed to sync offline records:", error);
    return NextResponse.json(
      { error: "Failed to synchronize offline records", success: false },
      { status: 500 }
    );
  }
}


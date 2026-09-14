import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { custodyLedger } from "@/db/schema";
import { eq, max } from "drizzle-orm";

export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = await request.json();

    const {
      evidence_id,
      timestamp,
      actor_badge_id,
      actor_name,
      action,
      notes,
      canonical_hash,
      signature,
      public_stamp,
      sync_status,
    } = body;

    const maxSeqRes = await db
      .select({ maxSeq: max(custodyLedger.sequenceNumber) })
      .from(custodyLedger)
      .where(eq(custodyLedger.evidenceId, evidence_id));

    const maxSeq = maxSeqRes[0]?.maxSeq ?? 0;
    const nextSeq = maxSeq + 1;

    const recordId = `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    await db.insert(custodyLedger).values({
      id: recordId,
      evidenceId: evidence_id,
      sequenceNumber: nextSeq,
      timestamp: timestamp || new Date().toISOString(),
      actorBadgeId: actor_badge_id,
      actorName: actor_name,
      action: action || "Custody Handover",
      notes: notes || "",
      canonicalHash: canonical_hash || "hash",
      signature: signature || "sig",
      publicStamp: public_stamp || "",
      syncStatus: sync_status || "synced",
    });

    return NextResponse.json({
      message: "Custody transfer record appended to SQLite DB",
      sequence_number: nextSeq,
      success: true,
    });
  } catch (error) {
    console.error("Failed to append custody record:", error);
    return NextResponse.json(
      { error: "Failed to append custody record", success: false },
      { status: 500 }
    );
  }
}


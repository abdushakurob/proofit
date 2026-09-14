import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { evidenceItems, custodyLedger, cases } from "@/db/schema";
import { eq, or, desc } from "drizzle-orm";

export async function GET(request: Request) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const evidenceId = searchParams.get("id");
    const caseId = searchParams.get("caseId");

    if (evidenceId) {
      const items = await db
        .select()
        .from(evidenceItems)
        .where(or(eq(evidenceItems.evidenceId, evidenceId), eq(evidenceItems.id, evidenceId)))
        .limit(1);

      const item = items[0];
      if (!item) {
        return NextResponse.json({ error: "Evidence item not found", success: false }, { status: 404 });
      }

      const custody = await db
        .select()
        .from(custodyLedger)
        .where(eq(custodyLedger.evidenceId, item.evidenceId))
        .orderBy(custodyLedger.sequenceNumber);

      return NextResponse.json({ item, custody, success: true });
    }

    if (caseId) {
      const items = await db
        .select()
        .from(evidenceItems)
        .where(eq(evidenceItems.caseId, caseId))
        .orderBy(desc(evidenceItems.sealedAt));
      return NextResponse.json({ items, success: true });
    }

    const items = await db
      .select()
      .from(evidenceItems)
      .orderBy(desc(evidenceItems.sealedAt))
      .limit(50);
    return NextResponse.json({ items, success: true });
  } catch (error) {
    console.error("Failed to query evidence:", error);
    return NextResponse.json({ error: "Failed to fetch evidence", success: false }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const db = getDb();
    const body = await request.json();

    const {
      id,
      case_id,
      evidence_id,
      original_filename,
      file_type,
      file_size_bytes,
      merkle_root,
      sealed_at,
      metadata_json,
      initial_custody,
      agency,
      investigating_officer_badge,
      title,
    } = body;

    const targetCaseId = case_id || "case-001";

    const existingCase = await db
      .select()
      .from(cases)
      .where(eq(cases.id, targetCaseId))
      .limit(1);

    if (existingCase.length === 0) {
      await db.insert(cases).values({
        id: targetCaseId,
        caseNumber: targetCaseId,
        title: title || `Case ${targetCaseId}`,
        agency: agency || "Law Enforcement Agency",
        investigatingOfficerBadge: investigating_officer_badge || initial_custody?.actor_badge_id || "UNKNOWN",
        createdAt: sealed_at || new Date().toISOString(),
        status: "Active",
      }).onConflictDoNothing();
    }

    const itemEvId = evidence_id || `evd-${Date.now()}`;
    const itemId = id || `ev-${Date.now()}`;

    await db.insert(evidenceItems).values({
      id: itemId,
      caseId: targetCaseId,
      evidenceId: itemEvId,
      originalFilename: original_filename || "unknown",
      fileType: file_type || "application/octet-stream",
      fileSizeBytes: file_size_bytes || 0,
      merkleRoot: merkle_root || "hash",
      sealedAt: sealed_at || new Date().toISOString(),
      status: "Sealed",
      metadataJson: typeof metadata_json === "string" ? metadata_json : JSON.stringify(metadata_json || {}),
    }).onConflictDoNothing();

    if (initial_custody) {
      await db.insert(custodyLedger).values({
        id: initial_custody.id || `cust-${Date.now()}`,
        evidenceId: itemEvId,
        sequenceNumber: 1,
        timestamp: initial_custody.timestamp || new Date().toISOString(),
        actorBadgeId: initial_custody.actor_badge_id,
        actorName: initial_custody.actor_name,
        action: initial_custody.action || "Evidence Sealed",
        notes: initial_custody.notes || "Initial evidence intake",
        canonicalHash: initial_custody.canonical_hash || "hash",
        signature: initial_custody.signature,
        publicStamp: initial_custody.public_stamp,
        syncStatus: initial_custody.sync_status || "synced",
      }).onConflictDoNothing();
    }

    return NextResponse.json({ message: "Evidence sealed and saved to SQLite DB", success: true });
  } catch (error) {
    console.error("Failed to save evidence:", error);
    return NextResponse.json({ error: "Failed to save evidence to SQLite DB", success: false }, { status: 500 });
  }
}


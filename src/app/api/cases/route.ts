import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { cases, evidenceItems } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function GET() {
  try {
    const db = getDb();

    const result = await db
      .select({
        id: cases.id,
        case_number: cases.caseNumber,
        title: cases.title,
        agency: cases.agency,
        investigating_officer_badge: cases.investigatingOfficerBadge,
        created_at: cases.createdAt,
        status: cases.status,
        evidence_count: sql<number>`count(${evidenceItems.id})`,
      })
      .from(cases)
      .leftJoin(evidenceItems, eq(cases.id, evidenceItems.caseId))
      .groupBy(cases.id)
      .orderBy(sql`${cases.createdAt} DESC`);

    return NextResponse.json({ cases: result, success: true });
  } catch (error) {
    console.error("Failed to fetch cases:", error);
    return NextResponse.json(
      { error: "Failed to fetch cases from SQLite backend", success: false },
      { status: 500 }
    );
  }
}


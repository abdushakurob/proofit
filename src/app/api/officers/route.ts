import { NextResponse } from "next/server";
import { getDb } from "@/db/client";
import { officerRegistry } from "@/db/schema";
import { eq } from "drizzle-orm";

const API_SECRET_TOKEN = "oin_live_sec_8f93e2b17a04c5d9e1823f4b6790a12c4e56";

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.select().from(officerRegistry);

    const officers = rows.map((r) => ({
      oin: r.badgeId,
      full_name: r.fullName,
      rank: r.rank,
      agency: r.agency,
      nin_hash: r.ninHash,
      public_stamp: r.publicStamp,
      status: "Active",
    }));

    return NextResponse.json({ officers, success: true });
  } catch (error) {
    console.error("Failed to fetch officers:", error);
    return NextResponse.json({ error: "Failed to fetch officer roster", success: false }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized. Valid Bearer API Key required from OIN Portal.", success: false },
        { status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "").trim();
    if (token !== API_SECRET_TOKEN) {
      return NextResponse.json(
        { error: "Forbidden. Invalid OIN API key.", success: false },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { oin, full_name, rank, agency, public_stamp } = body;

    if (!oin || !full_name || !agency) {
      return NextResponse.json(
        { error: "Missing required officer fields: oin, full_name, agency", success: false },
        { status: 400 }
      );
    }

    const db = getDb();
    const stamp = (public_stamp && typeof public_stamp === "string") ? public_stamp.trim() : "";

    await db
      .insert(officerRegistry)
      .values({
        badgeId: oin,
        fullName: full_name,
        rank: rank || "Investigating Officer",
        agency,
        ninHash: "oin_hash_" + oin,
        publicStamp: stamp,
      })
      .onConflictDoUpdate({
        target: officerRegistry.badgeId,
        set: {
          fullName: full_name,
          rank: rank || "Investigating Officer",
          agency,
          ...(stamp ? { publicStamp: stamp } : {}),
        },
      });

    return NextResponse.json({
      message: `Officer ${full_name} (${oin}) registered successfully in OIN Portal`,
      oin,
      success: true,
    });
  } catch (error) {
    console.error("Failed to register officer in OIN portal:", error);
    return NextResponse.json(
      { error: "Failed to register officer in database", success: false },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { oin, status, public_stamp } = body;

    if (!oin) {
      return NextResponse.json({ error: "Missing officer OIN", success: false }, { status: 400 });
    }

    const db = getDb();
    if (public_stamp) {
      await db
        .update(officerRegistry)
        .set({ publicStamp: public_stamp })
        .where(eq(officerRegistry.badgeId, oin));
    }

    return NextResponse.json({
      message: `Officer ${oin} registry record updated successfully`,
      oin,
      public_stamp,
      status: status || "Active",
      success: true,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update officer record", success: false }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const oin = searchParams.get("oin");

    if (!oin) {
      return NextResponse.json({ error: "Missing officer OIN parameter", success: false }, { status: 400 });
    }

    const db = getDb();
    await db.delete(officerRegistry).where(eq(officerRegistry.badgeId, oin));

    return NextResponse.json({
      message: `Officer ${oin} de-enrolled and deleted from OIN registry.`,
      oin,
      success: true,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete officer record", success: false }, { status: 500 });
  }
}


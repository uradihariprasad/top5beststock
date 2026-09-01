import { NextResponse } from "next/server";
import { db } from "@/db";
import { authSessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { fetchOIData } from "@/lib/oi-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Check auth
    const sessions = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.isActive, true))
      .orderBy(desc(authSessions.createdAt))
      .limit(1);

    const session = sessions[0];
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: "Not authenticated", authenticated: false },
        { status: 401 }
      );
    }

    const oiData = await fetchOIData(session.accessToken);

    return NextResponse.json({
      data: oiData,
      total: oiData.length,
      lastUpdate: new Date().toISOString(),
    });
  } catch (error) {
    console.error("OI data error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

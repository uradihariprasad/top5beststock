import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authSessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const instrumentKeys = req.nextUrl.searchParams.get("instruments");

    if (!instrumentKeys) {
      return NextResponse.json(
        { error: "instruments parameter required" },
        { status: 400 }
      );
    }

    const sessions = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.isActive, true))
      .orderBy(desc(authSessions.createdAt))
      .limit(1);

    if (sessions.length === 0 || !sessions[0].accessToken) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const accessToken = sessions[0].accessToken;

    const resp = await fetch(
      `https://api.upstox.com/v2/market-quote/quotes?instrument_key=${encodeURIComponent(instrumentKeys)}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      return NextResponse.json(
        { error: `Upstox API error: ${resp.status} ${errText}` },
        { status: resp.status }
      );
    }

    const data = await resp.json();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

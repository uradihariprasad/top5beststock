import { NextResponse } from "next/server";
import { db } from "@/db";
import { authSessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { getMarketDataFeedAuthorizeUrlV3 } from "@/lib/upstox-api";

// Start the market data feed - returns WebSocket URL for client
export async function POST() {
  try {
    const sessions = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.isActive, true))
      .orderBy(desc(authSessions.createdAt))
      .limit(1);

    if (sessions.length === 0 || !sessions[0].accessToken) {
      return NextResponse.json(
        { error: "Not authenticated. Please login first." },
        { status: 401 }
      );
    }

    const accessToken = sessions[0].accessToken;

    // Get WebSocket authorize URL
    const wsUrl = await getMarketDataFeedAuthorizeUrlV3(accessToken);

    return NextResponse.json({
      wsUrl,
      accessToken, // Needed for WS connection headers
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

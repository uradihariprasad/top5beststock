import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authSessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

// Save a manually provided access token
export async function POST(req: NextRequest) {
  try {
    const { accessToken, apiKey } = await req.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: "Access token is required" },
        { status: 400 }
      );
    }

    await db.insert(authSessions).values({
      apiKey: apiKey || "manual",
      apiSecret: "manual",
      redirectUri: "manual",
      accessToken,
      tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isActive: true,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Check current auth status
export async function GET() {
  try {
    const sessions = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.isActive, true))
      .orderBy(desc(authSessions.createdAt))
      .limit(1);

    if (sessions.length === 0 || !sessions[0].accessToken) {
      return NextResponse.json({ authenticated: false });
    }

    const session = sessions[0];
    const isExpired =
      session.tokenExpiry && session.tokenExpiry < new Date();

    return NextResponse.json({
      authenticated: !isExpired,
      apiKey: session.apiKey,
      hasToken: !!session.accessToken,
      expiry: session.tokenExpiry?.toISOString(),
    });
  } catch {
    return NextResponse.json({ authenticated: false });
  }
}

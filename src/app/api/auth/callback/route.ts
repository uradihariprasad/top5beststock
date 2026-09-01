import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authSessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { exchangeCodeForToken } from "@/lib/upstox-api";

export async function GET(req: NextRequest) {
  try {
    const code = req.nextUrl.searchParams.get("code");

    if (!code) {
      return NextResponse.redirect(
        new URL("/?error=no_code", req.nextUrl.origin)
      );
    }

    // Get the most recent session
    const sessions = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.isActive, true))
      .orderBy(desc(authSessions.createdAt))
      .limit(1);

    if (sessions.length === 0) {
      return NextResponse.redirect(
        new URL("/?error=no_session", req.nextUrl.origin)
      );
    }

    const session = sessions[0];

    // Exchange code for token
    const tokenData = await exchangeCodeForToken(
      code,
      session.apiKey,
      session.apiSecret,
      session.redirectUri
    );

    // Update session with access token
    await db
      .update(authSessions)
      .set({
        accessToken: tokenData.access_token,
        tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24hrs
        updatedAt: new Date(),
      })
      .where(eq(authSessions.id, session.id));

    return NextResponse.redirect(
      new URL("/?authenticated=true", req.nextUrl.origin)
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Callback failed";
    console.error("Auth callback error:", message);
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(message)}`, req.nextUrl.origin)
    );
  }
}

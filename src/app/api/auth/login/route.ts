import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { authSessions } from "@/db/schema";
import { getAuthorizationUrl } from "@/lib/upstox-api";

export async function POST(req: NextRequest) {
  try {
    const { apiKey, apiSecret, redirectUri } = await req.json();

    if (!apiKey || !apiSecret || !redirectUri) {
      return NextResponse.json(
        { error: "API Key, API Secret, and Redirect URI are required" },
        { status: 400 }
      );
    }

    // Save session
    await db.insert(authSessions).values({
      apiKey,
      apiSecret,
      redirectUri,
      isActive: true,
    });

    // Generate auth URL
    const authUrl = await getAuthorizationUrl(apiKey, redirectUri, "upstox_auth");

    return NextResponse.json({ authUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

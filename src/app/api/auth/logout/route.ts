import { NextResponse } from "next/server";
import { db } from "@/db";
import { authSessions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST() {
  try {
    await db
      .update(authSessions)
      .set({ isActive: false })
      .where(eq(authSessions.isActive, true));
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: false }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { momentumEvents } from "@/db/schema";
import { desc, eq, and, gte, lte } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const dateStr = req.nextUrl.searchParams.get("date");
    const direction = req.nextUrl.searchParams.get("direction");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "50");

    const conditions = [eq(momentumEvents.state, "COMPLETED")];

    if (dateStr) {
      const date = new Date(dateStr);
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      conditions.push(gte(momentumEvents.startTime, date));
      conditions.push(lte(momentumEvents.startTime, nextDate));
    }

    if (direction) {
      conditions.push(eq(momentumEvents.direction, direction));
    }

    const events = await db
      .select()
      .from(momentumEvents)
      .where(and(...conditions))
      .orderBy(desc(momentumEvents.startTime))
      .limit(limit);

    return NextResponse.json({
      events: events.map((e) => ({
        ...e,
        startTime: e.startTime.toISOString(),
        endTime: e.endTime?.toISOString(),
        reasons: e.reasons as string[],
      })),
      total: events.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

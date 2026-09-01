import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { momentumEvents } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { MomentumSignal } from "@/lib/types";

// Save or update a momentum event
export async function POST(req: NextRequest) {
  try {
    const signal: MomentumSignal = await req.json();

    if (!signal.instrumentKey || !signal.direction) {
      return NextResponse.json(
        { error: "Invalid signal data" },
        { status: 400 }
      );
    }

    // Check if there's an existing active event for this instrument
    const existing = await db
      .select()
      .from(momentumEvents)
      .where(
        and(
          eq(momentumEvents.instrumentKey, signal.instrumentKey),
          eq(momentumEvents.state, "ACTIVE"),
          eq(momentumEvents.direction, signal.direction)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing event
      await db
        .update(momentumEvents)
        .set({
          currentPrice: signal.currentPrice,
          confidenceScore: signal.confidenceScore,
          confidenceGrade: signal.confidenceGrade,
          ageCategory: signal.ageCategory,
          durationMinutes: signal.durationMinutes,
          orderFlowScore: signal.metrics.orderFlowScore,
          cumulativeDelta: signal.metrics.cumulativeDelta,
          relativeVolume: signal.metrics.relativeVolume,
          vwapDistance: signal.metrics.vwapDistance,
          vwapSlope: signal.metrics.vwapSlope,
          oiChange: signal.metrics.oiChange,
          oiBehavior: signal.metrics.oiBehavior,
          trendScore: signal.metrics.trendScore,
          absorptionDetected: signal.metrics.absorptionDetected,
          maxFavorableExcursion: signal.maxFavorableExcursion,
          maxAdverseExcursion: signal.maxAdverseExcursion,
          reasons: signal.reasons,
          state: signal.state,
          endTime: signal.state === "COMPLETED" ? new Date() : null,
          endPrice:
            signal.state === "COMPLETED" ? signal.currentPrice : null,
          updatedAt: new Date(),
        })
        .where(eq(momentumEvents.id, existing[0].id));

      return NextResponse.json({ updated: true, id: existing[0].id });
    } else {
      // Create new event
      const result = await db
        .insert(momentumEvents)
        .values({
          instrumentKey: signal.instrumentKey,
          tradingSymbol: signal.tradingSymbol,
          direction: signal.direction,
          state: signal.state,
          startTime: new Date(signal.startTime),
          startPrice: signal.startPrice,
          currentPrice: signal.currentPrice,
          confidenceScore: signal.confidenceScore,
          confidenceGrade: signal.confidenceGrade,
          ageCategory: signal.ageCategory,
          durationMinutes: signal.durationMinutes,
          orderFlowScore: signal.metrics.orderFlowScore,
          cumulativeDelta: signal.metrics.cumulativeDelta,
          relativeVolume: signal.metrics.relativeVolume,
          vwapDistance: signal.metrics.vwapDistance,
          vwapSlope: signal.metrics.vwapSlope,
          oiChange: signal.metrics.oiChange,
          oiBehavior: signal.metrics.oiBehavior,
          trendScore: signal.metrics.trendScore,
          absorptionDetected: signal.metrics.absorptionDetected,
          maxFavorableExcursion: signal.maxFavorableExcursion,
          maxAdverseExcursion: signal.maxAdverseExcursion,
          reasons: signal.reasons,
        })
        .returning({ id: momentumEvents.id });

      return NextResponse.json({ created: true, id: result[0]?.id });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

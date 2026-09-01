import { NextResponse } from "next/server";
import { db } from "@/db";
import { momentumEvents, authSessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import type { DashboardData, MomentumSignal } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sessions = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.isActive, true))
      .orderBy(desc(authSessions.createdAt))
      .limit(1);

    const hasToken = sessions.length > 0 && !!sessions[0].accessToken;

    const activeEvents = await db
      .select()
      .from(momentumEvents)
      .where(eq(momentumEvents.state, "ACTIVE"))
      .orderBy(desc(momentumEvents.confidenceScore));

    const signals: MomentumSignal[] = activeEvents.map((evt) => ({
      instrumentKey: evt.instrumentKey,
      tradingSymbol: evt.tradingSymbol,
      direction: evt.direction as "BUY" | "SELL",
      state: evt.state as "ACTIVE" | "COMPLETED",
      startTime: evt.startTime.toISOString(),
      endTime: evt.endTime?.toISOString(),
      startPrice: evt.startPrice,
      endPrice: evt.endPrice ?? undefined,
      currentPrice: evt.currentPrice ?? evt.startPrice,
      confidenceScore: evt.confidenceScore,
      confidenceGrade: (evt.confidenceGrade ?? "B") as "A+" | "A" | "B+" | "B",
      ageCategory: (evt.ageCategory ?? "Emerging") as MomentumSignal["ageCategory"],
      durationMinutes: evt.durationMinutes ?? 0,
      metrics: {
        orderFlowScore: evt.orderFlowScore ?? 50,
        cumulativeDelta: evt.cumulativeDelta ?? 0,
        deltaVelocity: 0,
        deltaAcceleration: 0,
        relativeVolume: evt.relativeVolume ?? 1,
        vwapDistance: evt.vwapDistance ?? 0,
        vwapSlope: evt.vwapSlope ?? 0,
        oiChange: evt.oiChange ?? 0,
        oiBehavior: evt.oiBehavior ?? "Unknown",
        trendScore: evt.trendScore ?? 50,
        absorptionDetected: evt.absorptionDetected ?? false,
        momentumPersistence: 0,
      },
      reasons: (evt.reasons as string[]) ?? [],
      maxFavorableExcursion: evt.maxFavorableExcursion ?? 0,
      maxAdverseExcursion: evt.maxAdverseExcursion ?? 0,
    }));

    const topBuy = signals
      .filter((s) => s.direction === "BUY" && s.confidenceScore >= 60)
      .slice(0, 10);
    const topSell = signals
      .filter((s) => s.direction === "SELL" && s.confidenceScore >= 60)
      .slice(0, 10);

    const data: DashboardData = {
      topBuy,
      topSell,
      marketStatus: hasToken ? "Connected" : "Not Authenticated",
      lastUpdate: new Date().toISOString(),
      totalFnoStocks: 60,
      activeConnections: hasToken ? 1 : 0,
      wsConnected: hasToken,
    };

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

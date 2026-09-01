import { NextResponse } from "next/server";
import { db } from "@/db";
import { authSessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import type { DashboardData } from "@/lib/types";
import {
  fetchMarketQuotes,
  processMarketData,
  getAllInstrumentKeys,
} from "@/lib/market-data-service";
import { fetchOIData } from "@/lib/oi-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Cache last successful LIVE data only
let cachedData: DashboardData | null = null;
let lastSuccessfulFetch = 0;
let consecutiveFailures = 0;
const CACHE_TTL = 30000;

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
    const hasToken = session && !!session.accessToken;

    // Not authenticated → tell the client to show login
    if (!hasToken) {
      return NextResponse.json({
        topBuy: [],
        topSell: [],
        marketStatus: "Not Authenticated",
        lastUpdate: new Date().toISOString(),
        totalFnoStocks: 0,
        activeConnections: 0,
        wsConnected: false,
      } satisfies DashboardData);
    }

    // Check if token expired
    if (session.tokenExpiry && session.tokenExpiry < new Date()) {
      return NextResponse.json({
        topBuy: [],
        topSell: [],
        marketStatus: "Token Expired",
        lastUpdate: new Date().toISOString(),
        totalFnoStocks: 0,
        activeConnections: 0,
        wsConnected: false,
      } satisfies DashboardData);
    }

    // Fetch live market data from Upstox with retry
    const instrumentKeys = getAllInstrumentKeys();
    const quotes = await fetchMarketQuotesWithRetry(session.accessToken!, instrumentKeys);

    if (!quotes || Object.keys(quotes).length === 0) {
      consecutiveFailures++;

      // Return cached LIVE data if recent
      if (cachedData && (Date.now() - lastSuccessfulFetch) < CACHE_TTL) {
        return NextResponse.json({
          ...cachedData,
          marketStatus: "Live (Cached)",
          lastUpdate: new Date().toISOString(),
        });
      }

      // Return empty with error status
      return NextResponse.json({
        topBuy: cachedData?.topBuy ?? [],
        topSell: cachedData?.topSell ?? [],
        marketStatus: consecutiveFailures > 3 ? "API Error – Check Token" : "Reconnecting...",
        lastUpdate: new Date().toISOString(),
        totalFnoStocks: 0,
        activeConnections: 0,
        wsConnected: false,
      } satisfies DashboardData);
    }

    // Success
    consecutiveFailures = 0;

    // Fetch OI data from futures contracts
    const oiMap = new Map<string, { oiChange: number; oiChangePct: number; oiBehavior: string; oi: number }>();
    try {
      const oiData = await fetchOIData(session.accessToken!);
      for (const d of oiData) {
        oiMap.set(d.symbol, {
          oiChange: d.oiChange,
          oiChangePct: d.oiChangePct,
          oiBehavior: d.oiBehavior,
          oi: d.oi,
        });
      }
    } catch (e) {
      console.error("OI fetch failed (non-blocking):", e);
    }

    // Process through momentum engine
    const { topBuy, topSell } = processMarketData(quotes, oiMap);

    const data: DashboardData = {
      topBuy,
      topSell,
      marketStatus: "Live",
      lastUpdate: new Date().toISOString(),
      totalFnoStocks: Object.keys(quotes).length,
      activeConnections: 1,
      wsConnected: true,
    };

    cachedData = data;
    lastSuccessfulFetch = Date.now();

    return NextResponse.json(data);
  } catch (error) {
    console.error("Live scanner error:", error);
    consecutiveFailures++;

    if (cachedData && (Date.now() - lastSuccessfulFetch) < CACHE_TTL * 2) {
      return NextResponse.json({
        ...cachedData,
        marketStatus: "Live (Cached)",
        lastUpdate: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      topBuy: [],
      topSell: [],
      marketStatus: "Error – Retry",
      lastUpdate: new Date().toISOString(),
      totalFnoStocks: 0,
      activeConnections: 0,
      wsConnected: false,
    } satisfies DashboardData);
  }
}

async function fetchMarketQuotesWithRetry(
  accessToken: string,
  instrumentKeys: string[],
  maxRetries: number = 2
): ReturnType<typeof fetchMarketQuotes> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const quotes = await fetchMarketQuotes(accessToken, instrumentKeys);
      if (quotes && Object.keys(quotes).length > 0) return quotes;
    } catch (error) {
      console.error(`Fetch attempt ${attempt + 1} failed:`, error);
    }
    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)));
    }
  }
  return null;
}

import { NextResponse } from "next/server";
import { db } from "@/db";
import { authSessions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { FNO_STOCKS } from "@/lib/fno-stocks";
import { fetchOIData, getOIMap } from "@/lib/oi-service";

export const dynamic = "force-dynamic";

const UPSTOX_API = "https://api.upstox.com/v2";

// Cache for market data
let cachedStocks: StockData[] = [];
let lastFetchTime = 0;
const CACHE_TTL = 10000; // 10 seconds

interface StockData {
  instrumentKey: string;
  symbol: string;
  name: string;
  ltp: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  oi: number;
  oiChange: number;
  vwap: number;
  totalBuyQty: number;
  totalSellQty: number;
  bidPrice: number;
  askPrice: number;
}

export async function GET() {
  try {
    // Return cached data if fresh
    if (cachedStocks.length > 0 && (Date.now() - lastFetchTime) < CACHE_TTL) {
      return NextResponse.json({
        stocks: cachedStocks,
        total: cachedStocks.length,
        lastUpdate: new Date(lastFetchTime).toISOString(),
        cached: true,
      });
    }

    // Check auth
    const sessions = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.isActive, true))
      .orderBy(desc(authSessions.createdAt))
      .limit(1);

    const session = sessions[0];
    if (!session?.accessToken) {
      return NextResponse.json(
        { error: "Not authenticated", authenticated: false },
        { status: 401 }
      );
    }

    // Fetch market data for all F&O stocks
    const instrumentKeys = FNO_STOCKS.map((s) => s.instrumentKey);
    const allStocks: StockData[] = [];

    // Batch fetch (50 at a time)
    for (let i = 0; i < instrumentKeys.length; i += 50) {
      const batch = instrumentKeys.slice(i, i + 50);
      const keysParam = batch.join(",");

      const response = await fetch(
        `${UPSTOX_API}/market-quote/quotes?instrument_key=${encodeURIComponent(keysParam)}`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
            Accept: "application/json",
          },
          cache: "no-store",
        }
      );

      if (!response.ok) {
        console.error(`Upstox API error: ${response.status}`);
        continue;
      }

      const data = await response.json();
      
      if (data.status === "success" && data.data) {
        for (const [key, quote] of Object.entries(data.data)) {
          const q = quote as Record<string, unknown>;
          const ohlc = q.ohlc as { open: number; high: number; low: number; close: number } | undefined;
          const depth = q.depth as { buy: Array<{ price: number }>; sell: Array<{ price: number }> } | undefined;
          
          // Handle response key format: "NSE_EQ:RELIANCE" or "NSE_EQ|INE002A01018"
          let stock = FNO_STOCKS.find((s) => s.instrumentKey === key);
          if (!stock) {
            // Try parsing "NSE_EQ:SYMBOL" format
            const parts = key.split(":");
            if (parts.length === 2) {
              stock = FNO_STOCKS.find((s) => s.symbol === parts[1]);
            }
          }
          if (!stock) continue;

          const ltp = (q.last_price as number) || 0;
          const close = ohlc?.close || ltp;
          const change = ltp - close;
          const changePercent = close > 0 ? (change / close) * 100 : 0;

          allStocks.push({
            instrumentKey: key,
            symbol: stock.symbol,
            name: stock.name,
            ltp,
            change,
            changePercent,
            open: ohlc?.open || 0,
            high: ohlc?.high || 0,
            low: ohlc?.low || 0,
            close,
            volume: (q.volume as number) || 0,
            oi: (q.oi as number) || 0,
            oiChange: 0, // Would need previous OI
            vwap: (q.average_price as number) || ltp,
            totalBuyQty: (q.total_buy_quantity as number) || 0,
            totalSellQty: (q.total_sell_quantity as number) || 0,
            bidPrice: depth?.buy?.[0]?.price || 0,
            askPrice: depth?.sell?.[0]?.price || 0,
          });
        }
      }

      // Rate limit protection
      if (i + 50 < instrumentKeys.length) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    // Fetch OI data from futures and merge
    try {
      const oiData = await fetchOIData(session.accessToken!);
      const oiLookup = getOIMap(oiData);

      for (const stock of allStocks) {
        const oi = oiLookup.get(stock.symbol);
        if (oi) {
          stock.oi = oi.oi;
          stock.oiChange = oi.oiChangePct;
        }
      }
    } catch (e) {
      console.error("OI merge error (non-blocking):", e);
    }

    // Sort by absolute change percent (most active)
    allStocks.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

    // Cache successful data
    if (allStocks.length > 0) {
      cachedStocks = allStocks;
      lastFetchTime = Date.now();
    }

    return NextResponse.json({
      stocks: allStocks,
      total: allStocks.length,
      lastUpdate: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Market data error:", error);
    
    // Return cached data on error
    if (cachedStocks.length > 0) {
      return NextResponse.json({
        stocks: cachedStocks,
        total: cachedStocks.length,
        lastUpdate: new Date(lastFetchTime).toISOString(),
        cached: true,
      });
    }
    
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

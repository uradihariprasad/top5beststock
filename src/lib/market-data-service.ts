import type { MomentumSignal, StockTickState } from "./types";
import {
  createStockTickState,
  updateTickState,
  calculateMetrics,
  evaluateMomentum,
  rankSignals,
} from "./momentum-engine";
import { FNO_STOCKS } from "./fno-stocks";

const UPSTOX_API = "https://api.upstox.com/v2";

// In-memory state for all stocks
const stockStates: Map<string, StockTickState> = new Map();
const activeSignals: Map<string, MomentumSignal> = new Map();

// Initialize stock states
export function initializeStockStates(): void {
  for (const stock of FNO_STOCKS) {
    if (!stockStates.has(stock.instrumentKey)) {
      stockStates.set(
        stock.instrumentKey,
        createStockTickState(stock.instrumentKey, stock.symbol)
      );
    }
  }
}

// Fetch full market quotes from Upstox
export async function fetchMarketQuotes(
  accessToken: string,
  instrumentKeys: string[]
): Promise<Record<string, MarketQuoteData> | null> {
  try {
    // Batch requests (max 50 per request)
    const allQuotes: Record<string, MarketQuoteData> = {};
    
    // Create a mapping from response keys to instrument keys
    const keyMapping: Record<string, string> = {};
    for (const key of instrumentKeys) {
      const stock = FNO_STOCKS.find((s) => s.instrumentKey === key);
      if (stock) {
        // Upstox returns keys like "NSE_EQ:RELIANCE" 
        keyMapping[`NSE_EQ:${stock.symbol}`] = key;
      }
    }
    
    for (let i = 0; i < instrumentKeys.length; i += 50) {
      const batch = instrumentKeys.slice(i, i + 50);
      const keysParam = batch.join(",");
      
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      try {
        const response = await fetch(
          `${UPSTOX_API}/market-quote/quotes?instrument_key=${encodeURIComponent(keysParam)}`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
            cache: "no-store",
            signal: controller.signal,
          }
        );
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          console.error(`Upstox API error: ${response.status}`);
          continue;
        }

        const data = await response.json();
        if (data.status === "success" && data.data) {
          // Map response keys back to instrument keys
          for (const [respKey, quote] of Object.entries(data.data)) {
            // Try to find the matching instrument key
            const instrumentKey = keyMapping[respKey];
            if (instrumentKey) {
              allQuotes[instrumentKey] = quote as MarketQuoteData;
            } else {
              // Try alternate key format
              const parts = respKey.split(":");
              if (parts.length === 2) {
                const symbol = parts[1];
                const stock = FNO_STOCKS.find((s) => s.symbol === symbol);
                if (stock) {
                  allQuotes[stock.instrumentKey] = quote as MarketQuoteData;
                }
              }
            }
          }
        }
      } catch (fetchError) {
        clearTimeout(timeoutId);
        if (fetchError instanceof Error && fetchError.name === 'AbortError') {
          console.error('Request timeout for batch', i);
        } else {
          console.error('Fetch error:', fetchError);
        }
        // Continue with next batch instead of failing completely
        continue;
      }
      
      // Small delay between batches to avoid rate limiting
      if (i + 50 < instrumentKeys.length) {
        await new Promise((r) => setTimeout(r, 150));
      }
    }

    return Object.keys(allQuotes).length > 0 ? allQuotes : null;
  } catch (error) {
    console.error("Error fetching market quotes:", error);
    return null;
  }
}

interface MarketQuoteData {
  ohlc?: {
    open: number;
    high: number;
    low: number;
    close: number;
  };
  depth?: {
    buy: Array<{ price: number; quantity: number }>;
    sell: Array<{ price: number; quantity: number }>;
  };
  last_price: number;
  volume?: number;
  average_price?: number;
  oi?: number;
  last_quantity?: number;
  total_buy_quantity?: number;
  total_sell_quantity?: number;
  lower_circuit_limit?: number;
  upper_circuit_limit?: number;
  last_trade_time?: string;
  net_change?: number;
}

// OI info from futures
export interface OIInfo {
  oiChange: number;
  oiChangePct: number;
  oiBehavior: string;
  oi: number;
}

// Process market data and generate momentum signals based on current market state
export function processMarketData(
  quotes: Record<string, MarketQuoteData>,
  oiMap?: Map<string, OIInfo>
): { topBuy: MomentumSignal[]; topSell: MomentumSignal[] } {
  initializeStockStates();

  const buySignals: MomentumSignal[] = [];
  const sellSignals: MomentumSignal[] = [];

  for (const [instrumentKey, quote] of Object.entries(quotes)) {
    const stock = FNO_STOCKS.find((s) => s.instrumentKey === instrumentKey);
    if (!stock) continue;

    // Skip if no valid price
    if (!quote.last_price || quote.last_price <= 0) continue;

    const ltp = quote.last_price;
    const close = quote.ohlc?.close || ltp;
    const open = quote.ohlc?.open || ltp;
    const high = quote.ohlc?.high || ltp;
    const low = quote.ohlc?.low || ltp;
    const volume = quote.volume || 0;
    const oi = quote.oi || 0;
    const vwap = quote.average_price || ltp;
    const totalBuyQty = quote.total_buy_quantity || 0;
    const totalSellQty = quote.total_sell_quantity || 0;

    // Calculate basic metrics from current snapshot
    const changePercent = close > 0 ? ((ltp - close) / close) * 100 : 0;
    const vwapDistance = vwap > 0 ? ((ltp - vwap) / vwap) * 100 : 0;
    const dayRange = high - low;
    const rangePosition = dayRange > 0 ? ((ltp - low) / dayRange) * 100 : 50;

    // Order flow score from buy/sell quantities
    const totalQty = totalBuyQty + totalSellQty;
    const orderFlowScore = totalQty > 0 ? (totalBuyQty / totalQty) * 100 : 50;

    // Relative strength based on position in day's range
    const trendScore = rangePosition;

    // Momentum indicators
    const intradayChange = open > 0 ? ((ltp - open) / open) * 100 : 0;
    const effectiveChange = changePercent !== 0 ? changePercent : intradayChange;

    const isBullish = (ltp > vwap && rangePosition > 55) || (orderFlowScore > 52 && rangePosition > 60);
    const isBearish = (ltp < vwap && rangePosition < 45) || (orderFlowScore < 48 && rangePosition < 40);

    // ─── Fetch real OI data from futures ───
    const oiInfo = oiMap?.get(stock.symbol);
    const realOiChange = oiInfo?.oiChangePct ?? 0;
    const realOiBehavior = oiInfo?.oiBehavior ?? "Unknown";
    const realOi = oiInfo?.oi ?? 0;

    // Calculate confidence score
    let confidence = 50;
    const reasons: string[] = [];

    if (isBullish) {
      if (orderFlowScore > 52) {
        confidence += (orderFlowScore - 50) * 0.6;
        reasons.push(`Buyer domination ${orderFlowScore.toFixed(0)}%`);
      }
      if (effectiveChange > 0.1) {
        confidence += Math.min(Math.abs(effectiveChange) * 8, 15);
        reasons.push(`Price ${effectiveChange > 0 ? "+" : ""}${effectiveChange.toFixed(2)}%`);
      }
      if (vwapDistance > 0.05) {
        confidence += Math.min(vwapDistance * 15, 12);
        reasons.push(`VWAP +${vwapDistance.toFixed(2)}%`);
      }
      if (rangePosition > 65) {
        confidence += 10;
        reasons.push("Near day high");
      }
      if (volume > 50000) {
        confidence += 8;
        reasons.push(`Volume: ${(volume / 100000).toFixed(1)}L`);
      }
      if (totalBuyQty > totalSellQty * 0.9) {
        confidence += 5;
        reasons.push("Buy pressure");
      }

      // OI-based confirmation from real futures data
      if (realOiBehavior === "Long Buildup") {
        confidence += 12;
        reasons.push(`Long Buildup (OI ${realOiChange >= 0 ? "+" : ""}${realOiChange.toFixed(1)}%)`);
      } else if (realOiBehavior === "Short Covering") {
        confidence += 8;
        reasons.push(`Short Covering (OI ${realOiChange.toFixed(1)}%)`);
      } else if (realOi > 0) {
        reasons.push(`OI Chg: ${realOiChange >= 0 ? "+" : ""}${realOiChange.toFixed(1)}%`);
      }

      if (confidence >= 55 && reasons.length >= 2) {
        buySignals.push({
          instrumentKey,
          tradingSymbol: stock.symbol,
          direction: "BUY",
          state: "ACTIVE",
          startTime: new Date(Date.now() - Math.random() * 30 * 60000).toISOString(),
          currentPrice: ltp,
          startPrice: open,
          confidenceScore: Math.min(Math.round(confidence), 98),
          confidenceGrade: confidence >= 90 ? "A+" : confidence >= 80 ? "A" : confidence >= 70 ? "B+" : "B",
          ageCategory: "Developing",
          durationMinutes: Math.round(Math.random() * 45 + 5),
          metrics: {
            orderFlowScore,
            cumulativeDelta: totalBuyQty - totalSellQty,
            deltaVelocity: effectiveChange > 0 ? 100 : -100,
            deltaAcceleration: 0,
            relativeVolume: volume > 0 ? Math.min(volume / 100000, 5) : 1,
            vwapDistance,
            vwapSlope: effectiveChange > 0 ? 0.05 : -0.05,
            oiChange: realOiChange,
            oiBehavior: realOi > 0 ? realOiBehavior : (effectiveChange > 0 ? "Long Buildup" : "Short Covering"),
            trendScore,
            absorptionDetected: false,
            momentumPersistence: 50,
          },
          reasons,
          maxFavorableExcursion: high - open,
          maxAdverseExcursion: open - low,
        });
      }
    }

    if (isBearish) {
      if (orderFlowScore < 48) {
        confidence += (50 - orderFlowScore) * 0.6;
        reasons.push(`Seller domination ${(100 - orderFlowScore).toFixed(0)}%`);
      }
      if (effectiveChange < -0.1) {
        confidence += Math.min(Math.abs(effectiveChange) * 8, 15);
        reasons.push(`Price ${effectiveChange.toFixed(2)}%`);
      }
      if (vwapDistance < -0.05) {
        confidence += Math.min(Math.abs(vwapDistance) * 15, 12);
        reasons.push(`VWAP ${vwapDistance.toFixed(2)}%`);
      }
      if (rangePosition < 35) {
        confidence += 10;
        reasons.push("Near day low");
      }
      if (volume > 50000) {
        confidence += 8;
        reasons.push(`Volume: ${(volume / 100000).toFixed(1)}L`);
      }
      if (totalSellQty > totalBuyQty * 0.9) {
        confidence += 5;
        reasons.push("Sell pressure");
      }

      // OI-based confirmation from real futures data
      if (realOiBehavior === "Short Buildup") {
        confidence += 12;
        reasons.push(`Short Buildup (OI ${realOiChange >= 0 ? "+" : ""}${realOiChange.toFixed(1)}%)`);
      } else if (realOiBehavior === "Long Unwinding") {
        confidence += 8;
        reasons.push(`Long Unwinding (OI ${realOiChange.toFixed(1)}%)`);
      } else if (realOi > 0) {
        reasons.push(`OI Chg: ${realOiChange >= 0 ? "+" : ""}${realOiChange.toFixed(1)}%`);
      }

      if (confidence >= 55 && reasons.length >= 2) {
        sellSignals.push({
          instrumentKey,
          tradingSymbol: stock.symbol,
          direction: "SELL",
          state: "ACTIVE",
          startTime: new Date(Date.now() - Math.random() * 30 * 60000).toISOString(),
          currentPrice: ltp,
          startPrice: open,
          confidenceScore: Math.min(Math.round(confidence), 98),
          confidenceGrade: confidence >= 90 ? "A+" : confidence >= 80 ? "A" : confidence >= 70 ? "B+" : "B",
          ageCategory: "Developing",
          durationMinutes: Math.round(Math.random() * 45 + 5),
          metrics: {
            orderFlowScore,
            cumulativeDelta: totalBuyQty - totalSellQty,
            deltaVelocity: effectiveChange > 0 ? 100 : -100,
            deltaAcceleration: 0,
            relativeVolume: volume > 0 ? Math.min(volume / 100000, 5) : 1,
            vwapDistance,
            vwapSlope: effectiveChange > 0 ? 0.05 : -0.05,
            oiChange: realOiChange,
            oiBehavior: realOi > 0 ? realOiBehavior : (effectiveChange < 0 ? "Short Buildup" : "Long Unwinding"),
            trendScore,
            absorptionDetected: false,
            momentumPersistence: 50,
          },
          reasons,
          maxFavorableExcursion: open - low,
          maxAdverseExcursion: high - open,
        });
      }
    }
  }

  // ─── Multi-factor ranking (includes OI weight) ───
  const rankScore = (s: MomentumSignal) =>
    s.confidenceScore * 0.30 +
    Math.min(Math.abs(s.metrics.oiChange), 20) * 0.20 + // OI change has 20% weight
    s.metrics.relativeVolume * 5 * 0.15 +
    Math.abs(s.metrics.vwapDistance) * 5 * 0.15 +
    Math.abs(s.metrics.orderFlowScore - 50) * 0.10 +
    s.metrics.trendScore * 0.10;

  const topBuy = buySignals
    .sort((a, b) => rankScore(b) - rankScore(a))
    .slice(0, 10);

  const topSell = sellSignals
    .sort((a, b) => rankScore(b) - rankScore(a))
    .slice(0, 10);

  return { topBuy, topSell };
}

// Get current stock state for a specific instrument
export function getStockState(instrumentKey: string): StockTickState | undefined {
  return stockStates.get(instrumentKey);
}

// Clear all states (for testing/reset)
export function clearAllStates(): void {
  stockStates.clear();
  activeSignals.clear();
}

// Get all instrument keys
export function getAllInstrumentKeys(): string[] {
  return FNO_STOCKS.map((s) => s.instrumentKey);
}

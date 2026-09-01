import { FNO_STOCKS } from "./fno-stocks";

const UPSTOX_API = "https://api.upstox.com/v2";
const INSTRUMENTS_URL = "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz";

// ─── Types ───

interface InstrumentEntry {
  segment: string;
  name: string;
  exchange: string;
  expiry?: number;
  instrument_type: string;
  underlying_symbol?: string;
  instrument_key: string;
  lot_size: number;
  exchange_token?: string;
  underlying_key?: string;
  trading_symbol: string;
  strike_price?: number;
}

export interface OIData {
  symbol: string;
  instrumentKey: string; // EQ instrument key
  futuresKey: string;    // FO instrument key
  oi: number;
  prevOi: number;
  oiChange: number;
  oiChangePct: number;
  ltp: number;
  prevClose: number;
  priceChange: number;
  priceChangePct: number;
  oiBehavior: string; // Long Buildup, Short Buildup, etc
  volume: number;
  lotSize: number;
}

// ─── State ───

// Cache: symbol → futures instrument key
let futuresKeyMap: Map<string, { key: string; lotSize: number }> = new Map();
let futuresKeysLastFetch = 0;
const FUTURES_CACHE_TTL = 3600000; // 1 hour

// Cache: last fetched OI data
let cachedOIData: OIData[] = [];
let oiDataLastFetch = 0;
const OI_CACHE_TTL = 8000; // 8 seconds

// Previous day OI store (persists across polls within a session)
const prevOiStore: Map<string, number> = new Map();

// ─── Fetch Instrument Master & Extract Futures Keys ───

export async function loadFuturesInstrumentKeys(): Promise<Map<string, { key: string; lotSize: number }>> {
  // Return cache if fresh
  if (futuresKeyMap.size > 0 && (Date.now() - futuresKeysLastFetch) < FUTURES_CACHE_TTL) {
    return futuresKeyMap;
  }

  try {
    // Fetch the gzipped NSE instrument file
    const resp = await fetch(INSTRUMENTS_URL);

    if (!resp.ok) {
      console.error("Failed to fetch instruments:", resp.status);
      return futuresKeyMap;
    }

    // The response is gzipped - need to decompress
    const buffer = await resp.arrayBuffer();
    let jsonText: string;

    try {
      // Try decompressing with DecompressionStream (available in Node 18+)
      const ds = new DecompressionStream("gzip");
      const writer = ds.writable.getWriter();
      writer.write(new Uint8Array(buffer));
      writer.close();
      const reader = ds.readable.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      const totalLen = chunks.reduce((s, c) => s + c.length, 0);
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      jsonText = new TextDecoder().decode(merged);
    } catch {
      // Fallback: maybe the server already decompressed it
      jsonText = new TextDecoder().decode(buffer);
    }

    const instruments: InstrumentEntry[] = JSON.parse(jsonText);

    // Get current date for expiry comparison
    const now = Date.now();

    // Build a map: underlying_symbol → nearest futures contract
    const symbolFutures: Map<string, { key: string; expiry: number; lotSize: number }> = new Map();

    for (const inst of instruments) {
      if (
        inst.segment === "NSE_FO" &&
        inst.instrument_type === "FUT" &&
        inst.underlying_symbol &&
        inst.expiry &&
        inst.expiry > now // Not expired
      ) {
        const sym = inst.underlying_symbol;
        const existing = symbolFutures.get(sym);

        // Take the nearest (soonest) expiry
        if (!existing || inst.expiry < existing.expiry) {
          symbolFutures.set(sym, {
            key: inst.instrument_key,
            expiry: inst.expiry,
            lotSize: inst.lot_size,
          });
        }
      }
    }

    // Map to our FNO_STOCKS
    futuresKeyMap = new Map();
    for (const stock of FNO_STOCKS) {
      const futData = symbolFutures.get(stock.symbol);
      if (futData) {
        futuresKeyMap.set(stock.symbol, { key: futData.key, lotSize: futData.lotSize });
      }
    }

    futuresKeysLastFetch = Date.now();
    console.log(`Loaded ${futuresKeyMap.size} futures instrument keys`);
    return futuresKeyMap;
  } catch (error) {
    console.error("Error loading futures instrument keys:", error);
    return futuresKeyMap;
  }
}

// ─── Fetch OI Data from Futures Quotes ───

export async function fetchOIData(accessToken: string): Promise<OIData[]> {
  // Return cache if fresh
  if (cachedOIData.length > 0 && (Date.now() - oiDataLastFetch) < OI_CACHE_TTL) {
    return cachedOIData;
  }

  // Load futures keys
  const futKeys = await loadFuturesInstrumentKeys();

  if (futKeys.size === 0) {
    console.error("No futures keys available");
    return cachedOIData;
  }

  try {
    const allOIData: OIData[] = [];

    // Get all futures instrument keys
    const futuresEntries = Array.from(futKeys.entries()); // [symbol, {key, lotSize}]
    const futuresInstrumentKeys = futuresEntries.map(([, v]) => v.key);

    // Batch fetch quotes for futures contracts (50 at a time)
    const allQuotes: Record<string, Record<string, unknown>> = {};

    for (let i = 0; i < futuresInstrumentKeys.length; i += 40) {
      const batch = futuresInstrumentKeys.slice(i, i + 40);
      const keysParam = batch.join(",");

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

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

        if (response.ok) {
          const data = await response.json();
          if (data.status === "success" && data.data) {
            Object.assign(allQuotes, data.data);
          }
        }
      } catch (err) {
        clearTimeout(timeoutId);
        console.error("Futures batch fetch error:", err);
        continue;
      }

      // Rate limit
      if (i + 40 < futuresInstrumentKeys.length) {
        await new Promise(r => setTimeout(r, 150));
      }
    }

    // Process the quotes into OI data
    for (const [symbol, futInfo] of futuresEntries) {
      // Find matching quote - response key could be NSE_FO:{symbol} or similar
      let quote: Record<string, unknown> | undefined;

      // Try matching by various key formats
      for (const [respKey, q] of Object.entries(allQuotes)) {
        // Match by symbol suffix: "NSE_FO:RELIANCE"
        if (respKey.endsWith(`:${symbol}`)) {
          quote = q;
          break;
        }
        // Also check if instrument token matches
        const instrToken = (q as Record<string, unknown>).instrument_token as string | undefined;
        if (instrToken === futInfo.key) {
          quote = q;
          break;
        }
      }

      if (!quote) continue;

      const oi = (quote.oi as number) || 0;
      const ltp = (quote.last_price as number) || 0;
      const ohlc = quote.ohlc as { open: number; high: number; low: number; close: number } | undefined;
      const prevClose = ohlc?.close || ltp;
      const volume = (quote.volume as number) || 0;

      if (oi === 0 && ltp === 0) continue;

      // Get previous OI (from our store, or use close-based estimate)
      const storeKey = `${symbol}_oi`;
      let prevOi = prevOiStore.get(storeKey) || 0;

      // First time seeing this stock: store current as baseline
      if (prevOi === 0 && oi > 0) {
        prevOiStore.set(storeKey, oi);
        prevOi = oi; // First poll: no change
      }

      const oiChange = oi - prevOi;
      const oiChangePct = prevOi > 0 ? (oiChange / prevOi) * 100 : 0;

      const priceChange = ltp - prevClose;
      const priceChangePct = prevClose > 0 ? (priceChange / prevClose) * 100 : 0;

      // Determine OI behavior
      let oiBehavior = "Unknown";
      if (priceChangePct > 0.1 && oiChangePct > 0.1) oiBehavior = "Long Buildup";
      else if (priceChangePct < -0.1 && oiChangePct > 0.1) oiBehavior = "Short Buildup";
      else if (priceChangePct > 0.1 && oiChangePct < -0.1) oiBehavior = "Short Covering";
      else if (priceChangePct < -0.1 && oiChangePct < -0.1) oiBehavior = "Long Unwinding";
      else if (Math.abs(oiChangePct) < 0.1) oiBehavior = "No Significant Change";

      const stock = FNO_STOCKS.find(s => s.symbol === symbol);

      allOIData.push({
        symbol,
        instrumentKey: stock?.instrumentKey || "",
        futuresKey: futInfo.key,
        oi,
        prevOi,
        oiChange,
        oiChangePct,
        ltp,
        prevClose,
        priceChange,
        priceChangePct,
        oiBehavior,
        volume,
        lotSize: futInfo.lotSize,
      });
    }

    // Update previous OI for next poll comparison
    for (const d of allOIData) {
      prevOiStore.set(`${d.symbol}_oi`, d.oi);
    }

    // Sort by absolute OI change percentage
    allOIData.sort((a, b) => Math.abs(b.oiChangePct) - Math.abs(a.oiChangePct));

    if (allOIData.length > 0) {
      cachedOIData = allOIData;
      oiDataLastFetch = Date.now();
    }

    return allOIData;
  } catch (error) {
    console.error("Error fetching OI data:", error);
    return cachedOIData;
  }
}

// ─── Get OI map keyed by symbol ───

export function getOIMap(oiData: OIData[]): Map<string, OIData> {
  const map = new Map<string, OIData>();
  for (const d of oiData) {
    map.set(d.symbol, d);
  }
  return map;
}

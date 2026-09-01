import type { UpstoxInstrument } from "./types";

const UPSTOX_BASE = "https://api.upstox.com";

export async function getAuthorizationUrl(
  apiKey: string,
  redirectUri: string,
  state?: string
): Promise<string> {
  const params = new URLSearchParams({
    client_id: apiKey,
    redirect_uri: redirectUri,
    response_type: "code",
  });
  if (state) params.set("state", state);
  return `${UPSTOX_BASE}/v2/login/authorization/dialog?${params.toString()}`;
}

export async function exchangeCodeForToken(
  code: string,
  apiKey: string,
  apiSecret: string,
  redirectUri: string
): Promise<{ access_token: string }> {
  const body = new URLSearchParams({
    code,
    client_id: apiKey,
    client_secret: apiSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const resp = await fetch(`${UPSTOX_BASE}/v2/login/authorization/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Token exchange failed: ${resp.status} ${errText}`);
  }
  return resp.json();
}

export async function getMarketDataFeedAuthorizeUrl(
  accessToken: string
): Promise<string> {
  const resp = await fetch(
    `${UPSTOX_BASE}/v2/feed/market-data-feed/authorize`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );
  if (!resp.ok) {
    throw new Error(`Feed authorize failed: ${resp.status}`);
  }
  const data = await resp.json();
  return data.data?.authorizedRedirectUri || data.data?.authorized_redirect_uri;
}

export async function getMarketDataFeedAuthorizeUrlV3(
  accessToken: string
): Promise<string> {
  const resp = await fetch(
    `${UPSTOX_BASE}/v3/feed/market-data-feed/authorize`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    }
  );
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Feed authorize V3 failed: ${resp.status} ${errText}`);
  }
  const data = await resp.json();
  return data.data?.authorizedRedirectUri || data.data?.authorized_redirect_uri;
}

export async function fetchFullMarketQuotes(
  accessToken: string,
  instrumentKeys: string[]
): Promise<Record<string, unknown>> {
  // Batch in groups of 50
  const results: Record<string, unknown> = {};
  for (let i = 0; i < instrumentKeys.length; i += 50) {
    const batch = instrumentKeys.slice(i, i + 50);
    const params = new URLSearchParams({
      instrument_key: batch.join(","),
    });
    const resp = await fetch(
      `${UPSTOX_BASE}/v2/market-quote/quotes?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );
    if (resp.ok) {
      const data = await resp.json();
      if (data.data) {
        Object.assign(results, data.data);
      }
    }
    // Rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }
  return results;
}

export async function fetchOHLCQuotes(
  accessToken: string,
  instrumentKeys: string[],
  interval: string = "1d"
): Promise<Record<string, unknown>> {
  const results: Record<string, unknown> = {};
  for (let i = 0; i < instrumentKeys.length; i += 50) {
    const batch = instrumentKeys.slice(i, i + 50);
    const params = new URLSearchParams({
      instrument_key: batch.join(","),
      interval,
    });
    const resp = await fetch(
      `${UPSTOX_BASE}/v2/market-quote/ohlc?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );
    if (resp.ok) {
      const data = await resp.json();
      if (data.data) {
        Object.assign(results, data.data);
      }
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return results;
}

export async function fetchFnOInstruments(): Promise<UpstoxInstrument[]> {
  // Fetch NSE_FO instruments to identify F&O eligible stocks
  const resp = await fetch(
    "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz"
  );
  if (!resp.ok) {
    // Fallback: try the JSON version
    const resp2 = await fetch(
      "https://assets.upstox.com/market-quote/instruments/exchange/complete.json.gz"
    );
    if (!resp2.ok) {
      throw new Error("Failed to fetch instruments");
    }
    const allInstruments: UpstoxInstrument[] = await resp2.json();
    return filterFnOStocks(allInstruments);
  }

  const allInstruments: UpstoxInstrument[] = await resp.json();
  return filterFnOStocks(allInstruments);
}

function filterFnOStocks(instruments: UpstoxInstrument[]): UpstoxInstrument[] {
  // Find F&O underlying symbols from NSE_FO segment
  const foSymbols = new Set<string>();
  const eqInstruments: UpstoxInstrument[] = [];

  for (const inst of instruments) {
    if (inst.segment === "NSE_FO" && inst.underlying_symbol) {
      foSymbols.add(inst.underlying_symbol);
    }
    if (
      inst.segment === "NSE_EQ" &&
      inst.instrument_type === "EQ" &&
      inst.instrument_key
    ) {
      eqInstruments.push(inst);
    }
  }

  // Return EQ instruments that are F&O eligible
  return eqInstruments.filter(
    (inst) =>
      foSymbols.has(inst.trading_symbol) || foSymbols.has(inst.short_name || "")
  );
}

export async function getUserProfile(
  accessToken: string
): Promise<{ status: string; data?: Record<string, unknown> }> {
  const resp = await fetch(`${UPSTOX_BASE}/v2/user/profile`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });
  return resp.json();
}

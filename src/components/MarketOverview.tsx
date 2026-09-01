"use client";

import { useState, useEffect, useCallback } from "react";

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
}

export default function MarketOverview() {
  const [stocks, setStocks] = useState<StockData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState("");
  const [filter, setFilter] = useState<"all" | "gainers" | "losers">("all");
  const [searchTerm, setSearchTerm] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const resp = await fetch("/api/market-data", {
        signal: controller.signal,
        cache: "no-store",
      });
      
      clearTimeout(timeoutId);
      
      if (resp.ok) {
        const data = await resp.json();
        if (data.stocks && data.stocks.length > 0) {
          setStocks(data.stocks);
          setLastUpdate(new Date().toLocaleTimeString("en-IN"));
          setError("");
        } else if (data.error) {
          // Keep existing data on error
          if (stocks.length === 0) {
            setError(data.error);
          }
        }
      } else {
        // Keep existing data on failure
        if (stocks.length === 0) {
          const errData = await resp.json().catch(() => ({}));
          setError(errData.error || "Failed to fetch data");
        }
      }
    } catch (err) {
      // Keep existing data on error
      if (stocks.length === 0) {
        setError("Connecting...");
      }
    }
    setLoading(false);
  }, [stocks.length]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 8000); // Refresh every 8 seconds (reduced frequency)
    return () => clearInterval(interval);
  }, [fetchData]);

  const filteredStocks = stocks.filter((stock) => {
    const matchesSearch =
      stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      stock.name.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    if (filter === "gainers") return stock.changePercent > 0;
    if (filter === "losers") return stock.changePercent < 0;
    return true;
  });

  const formatNumber = (num: number, decimals: number = 2) => {
    if (num >= 10000000) return `${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `${(num / 100000).toFixed(2)} L`;
    if (num >= 1000) return `${(num / 1000).toFixed(2)} K`;
    return num.toFixed(decimals);
  };

  if (loading && stocks.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-12 h-12 rounded-full border-4 border-accent-blue/30 border-t-accent-blue animate-spin mx-auto mb-3" />
          <p className="text-text-secondary">Loading market data...</p>
        </div>
      </div>
    );
  }

  if (error && stocks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-4xl mb-3">⚠️</div>
        <p className="text-accent-red font-medium">{error}</p>
        <p className="text-text-muted text-sm mt-2">
          Make sure you have connected your Upstox account.
        </p>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-accent-blue/20 text-accent-blue rounded-lg text-sm font-medium hover:bg-accent-blue/30"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-bold text-text-primary">
          📊 F&O Market Overview
        </h2>
        <div className="flex-1" />
        
        {/* Search */}
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search stocks..."
          className="bg-bg-input border border-border-dark rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue w-48"
        />

        {/* Filter */}
        <div className="flex gap-1 bg-bg-dark rounded-lg p-0.5">
          {(["all", "gainers", "losers"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                filter === f
                  ? f === "gainers"
                    ? "bg-accent-green/20 text-accent-green"
                    : f === "losers"
                    ? "bg-accent-red/20 text-accent-red"
                    : "bg-accent-blue/20 text-accent-blue"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              {f === "all" ? "All" : f === "gainers" ? "↑ Gainers" : "↓ Losers"}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          onClick={fetchData}
          className="px-3 py-1.5 bg-bg-card border border-border-dark text-text-secondary rounded-lg text-xs font-medium hover:text-text-primary"
        >
          ↻ Refresh
        </button>

        {lastUpdate && (
          <span className="text-xs text-text-muted">
            Updated: {lastUpdate}
          </span>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Total Stocks"
          value={stocks.length.toString()}
          color="text-accent-blue"
        />
        <StatCard
          label="Gainers"
          value={stocks.filter((s) => s.changePercent > 0).length.toString()}
          color="text-accent-green"
        />
        <StatCard
          label="Losers"
          value={stocks.filter((s) => s.changePercent < 0).length.toString()}
          color="text-accent-red"
        />
        <StatCard
          label="Unchanged"
          value={stocks.filter((s) => s.changePercent === 0).length.toString()}
          color="text-text-muted"
        />
      </div>

      {/* Table */}
      <div className="bg-bg-card border border-border-dark rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted text-xs uppercase tracking-wider bg-bg-dark/50">
                <th className="px-4 py-3">Stock</th>
                <th className="px-4 py-3 text-right">LTP</th>
                <th className="px-4 py-3 text-right">Change</th>
                <th className="px-4 py-3 text-right">%</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">Open</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">High</th>
                <th className="px-4 py-3 text-right hidden sm:table-cell">Low</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">Volume</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">OI</th>
                <th className="px-4 py-3 text-right hidden md:table-cell">OI Chg</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">VWAP</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">Buy Qty</th>
                <th className="px-4 py-3 text-right hidden lg:table-cell">Sell Qty</th>
              </tr>
            </thead>
            <tbody>
              {filteredStocks.map((stock, idx) => (
                <tr
                  key={stock.instrumentKey}
                  className={`border-t border-border-dark/50 hover:bg-bg-card-hover transition-colors ${
                    idx % 2 === 0 ? "" : "bg-bg-dark/20"
                  }`}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-semibold text-text-primary">
                      {stock.symbol}
                    </div>
                    <div className="text-xs text-text-muted truncate max-w-[120px]">
                      {stock.name}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono font-medium text-text-primary">
                    ₹{stock.ltp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td
                    className={`px-4 py-2.5 text-right font-mono ${
                      stock.change > 0
                        ? "text-accent-green"
                        : stock.change < 0
                        ? "text-accent-red"
                        : "text-text-muted"
                    }`}
                  >
                    {stock.change > 0 ? "+" : ""}
                    {stock.change.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        stock.changePercent > 0
                          ? "bg-accent-green/20 text-accent-green"
                          : stock.changePercent < 0
                          ? "bg-accent-red/20 text-accent-red"
                          : "bg-bg-dark text-text-muted"
                      }`}
                    >
                      {stock.changePercent > 0 ? "+" : ""}
                      {stock.changePercent.toFixed(2)}%
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-secondary hidden sm:table-cell">
                    {stock.open.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-accent-green hidden sm:table-cell">
                    {stock.high.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-accent-red hidden sm:table-cell">
                    {stock.low.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-secondary hidden md:table-cell">
                    {formatNumber(stock.volume, 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-secondary hidden md:table-cell">
                    {stock.oi > 0 ? formatNumber(stock.oi, 0) : "—"}
                  </td>
                  <td className={`px-4 py-2.5 text-right font-mono hidden md:table-cell font-semibold ${
                    stock.oiChange > 0
                      ? "text-accent-green"
                      : stock.oiChange < 0
                      ? "text-accent-red"
                      : "text-text-muted"
                  }`}>
                    {stock.oi > 0
                      ? `${stock.oiChange >= 0 ? "+" : ""}${stock.oiChange.toFixed(1)}%`
                      : "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-text-secondary hidden lg:table-cell">
                    {stock.vwap.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-accent-green/80 hidden lg:table-cell">
                    {formatNumber(stock.totalBuyQty, 0)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-accent-red/80 hidden lg:table-cell">
                    {formatNumber(stock.totalSellQty, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredStocks.length === 0 && (
          <div className="text-center py-8 text-text-muted">
            No stocks found matching your criteria.
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-bg-card border border-border-dark rounded-lg px-4 py-3">
      <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

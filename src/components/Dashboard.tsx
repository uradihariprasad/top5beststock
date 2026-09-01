"use client";

import { useState, useEffect, useCallback } from "react";
import type { DashboardData, MomentumSignal } from "@/lib/types";
import MomentumCard from "./MomentumCard";
import HistoryPanel from "./HistoryPanel";
import MarketOverview from "./MarketOverview";

interface DashboardProps {
  onLogout: () => void;
}

export default function Dashboard({ onLogout }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [activeTab, setActiveTab] = useState<"scanner" | "market" | "history">("scanner");
  const [wsStatus, setWsStatus] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [lastPoll, setLastPoll] = useState<string>("");
  const [error, setError] = useState("");
  // removed unused demo/connect state

  const fetchDashboard = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const resp = await fetch("/api/live-scanner", {
        signal: controller.signal,
        cache: "no-store",
      });
      
      clearTimeout(timeoutId);
      
      if (resp.ok) {
        const d: DashboardData = await resp.json();
        setData(d);
        setLastPoll(new Date().toLocaleTimeString("en-IN"));
        
        if (d.marketStatus === "Live" || d.marketStatus === "Live (Cached)") {
          setWsStatus("connected");
          setError("");
        } else if (d.marketStatus === "Token Expired" || d.marketStatus === "Not Authenticated") {
          setWsStatus("disconnected");
          setError("");
        } else if (d.marketStatus.includes("Reconnecting") || d.marketStatus.includes("Connecting")) {
          setWsStatus("connecting");
          setError("");
        } else if (d.marketStatus.includes("Error") || d.marketStatus.includes("API Error")) {
          setWsStatus("disconnected");
          setError("");
        }
      } else {
        setWsStatus("connecting");
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        console.log("Request timeout - will retry");
      }
      setWsStatus("connecting");
      if (!data) {
        setError("Connecting to Upstox...");
      }
    }
  }, [data]);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 5000); // Poll every 5s (reduced from 3s)
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  // Feed is auto-started via REST polling

  const handleLogout = async () => {
    // Deactivate token in DB
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    setData(null);
    onLogout();
  };

  // Auth is handled by the login page

  return (
    <div className="min-h-screen">
      {/* Top Bar */}
      <header className="bg-bg-card border-b border-border-dark sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-green flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary">
                F&O Momentum Scanner
              </h1>
              <p className="text-[10px] text-text-muted">
                Live Upstox API V3 • NSE F&O Stocks Only
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Status Indicators */}
            <div className="hidden sm:flex items-center gap-3 text-xs">
              <StatusDot
                label="Market"
                status={data?.marketStatus === "Connected" ? "active" : "inactive"}
              />
              <StatusDot
                label="WebSocket"
                status={wsStatus === "connected" ? "active" : wsStatus === "connecting" ? "pending" : "inactive"}
              />
              <div className="text-text-muted">
                Stocks: <span className="text-text-primary">{data?.totalFnoStocks ?? 0}</span>
              </div>
              {lastPoll && (
                <div className="text-text-muted">
                  Updated: <span className="text-text-primary">{lastPoll}</span>
                </div>
              )}
            </div>

            {/* Actions */}
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 bg-bg-dark border border-border-dark text-text-secondary rounded-lg text-xs font-medium hover:text-text-primary transition-all"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Tab Nav */}
        <div className="max-w-[1600px] mx-auto px-4">
          <div className="flex gap-1">
            <TabButton
              active={activeTab === "scanner"}
              onClick={() => setActiveTab("scanner")}
              label="Momentum Scanner"
              icon="📡"
            />
            <TabButton
              active={activeTab === "market"}
              onClick={() => setActiveTab("market")}
              label="Market Overview"
              icon="📈"
            />
            <TabButton
              active={activeTab === "history"}
              onClick={() => setActiveTab("history")}
              label="History"
              icon="📊"
            />
          </div>
        </div>
      </header>

      {/* Token Expired Banner */}
      {data?.marketStatus === "Token Expired" && (
        <div className="max-w-[1600px] mx-auto px-4 mt-2">
          <div className="p-3 bg-accent-red/10 border border-accent-red/30 rounded-lg text-accent-red text-sm flex items-center gap-3">
            <span className="text-lg">🔑</span>
            <div>
              <span className="font-semibold">Token Expired</span> — Your Upstox access token has expired. Please logout and re-enter a fresh token.
            </div>
            <button onClick={handleLogout} className="ml-auto px-3 py-1 bg-accent-red/20 rounded-lg text-xs font-medium hover:bg-accent-red/30">
              Logout &amp; Re-login
            </button>
          </div>
        </div>
      )}

      {/* API Error Banner */}
      {data?.marketStatus === "API Error – Check Token" && (
        <div className="max-w-[1600px] mx-auto px-4 mt-2">
          <div className="p-3 bg-accent-orange/10 border border-accent-orange/30 rounded-lg text-accent-orange text-sm flex items-center gap-3">
            <span className="text-lg">⚠️</span>
            <div>
              <span className="font-semibold">Connection Lost</span> — Unable to fetch data from Upstox API. Token may have expired or market is closed.
            </div>
            <button onClick={handleLogout} className="ml-auto px-3 py-1 bg-accent-orange/20 rounded-lg text-xs font-medium hover:bg-accent-orange/30">
              Re-login
            </button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {error && (
        <div className="max-w-[1600px] mx-auto px-4 mt-2">
          <div className="p-3 bg-accent-red/10 border border-accent-red/30 rounded-lg text-accent-red text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError("")} className="text-accent-red/60 hover:text-accent-red">✕</button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="max-w-[1600px] mx-auto px-4 py-4">
        {activeTab === "scanner" ? (
          <ScannerView data={data} wsStatus={wsStatus} />
        ) : activeTab === "market" ? (
          <MarketOverview />
        ) : (
          <HistoryPanel />
        )}
      </main>

      {/* Auth is handled via LoginForm page */}
    </div>
  );
}

// ─── Scanner View ───

function ScannerView({
  data,
  wsStatus,
}: {
  data: DashboardData | null;
  wsStatus: string;
}) {
  if (!data) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-bg-card border border-border-dark flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-text-muted animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
          <p className="text-text-secondary">Loading scanner data...</p>
        </div>
      </div>
    );
  }

  const hasBuySignals = data.topBuy.length > 0;
  const hasSellSignals = data.topSell.length > 0;

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard
          label="Active BUY Signals"
          value={data.topBuy.length.toString()}
          color="text-accent-green"
          bg="bg-accent-green/5"
        />
        <StatCard
          label="Active SELL Signals"
          value={data.topSell.length.toString()}
          color="text-accent-red"
          bg="bg-accent-red/5"
        />
        <StatCard
          label="F&O Universe"
          value={data.totalFnoStocks.toString()}
          color="text-accent-blue"
          bg="bg-accent-blue/5"
        />
        <StatCard
          label="Feed Status"
          value={wsStatus === "connected" ? "LIVE" : "IDLE"}
          color={wsStatus === "connected" ? "text-accent-green" : "text-text-muted"}
          bg="bg-bg-card"
        />
      </div>

      {/* Two columns: BUY and SELL */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* BUY Column */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-accent-green animate-pulse-live" />
            <h2 className="text-lg font-bold text-accent-green">
              Top 10 BUY Momentum
            </h2>
          </div>
          <div className="space-y-3">
            {hasBuySignals ? (
              data.topBuy.map((signal: MomentumSignal, i: number) => (
                <MomentumCard key={signal.instrumentKey} signal={signal} rank={i + 1} />
              ))
            ) : (
              <EmptyState
                direction="BUY"
                message={
                  wsStatus === "connected"
                    ? "Scanning for BUY momentum — no qualifying signals right now"
                    : "Fetching live data from Upstox..."
                }
              />
            )}
          </div>
        </div>

        {/* SELL Column */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-3 h-3 rounded-full bg-accent-red animate-pulse-live" />
            <h2 className="text-lg font-bold text-accent-red">
              Top 10 SELL Momentum
            </h2>
          </div>
          <div className="space-y-3">
            {hasSellSignals ? (
              data.topSell.map((signal: MomentumSignal, i: number) => (
                <MomentumCard key={signal.instrumentKey} signal={signal} rank={i + 1} />
              ))
            ) : (
              <EmptyState
                direction="SELL"
                message={
                  wsStatus === "connected"
                    ? "Scanning for SELL momentum — no qualifying signals right now"
                    : "Fetching live data from Upstox..."
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Info Box */}
      <InfoBox />
    </div>
  );
}

// ─── Sub Components ───

function StatusDot({
  label,
  status,
}: {
  label: string;
  status: "active" | "pending" | "inactive";
}) {
  const dotColor =
    status === "active"
      ? "bg-accent-green"
      : status === "pending"
      ? "bg-accent-yellow"
      : "bg-text-muted";
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${dotColor} ${status === "active" ? "animate-pulse-live" : ""}`} />
      <span className="text-text-secondary">{label}</span>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium border-b-2 transition-all ${
        active
          ? "border-accent-blue text-accent-blue"
          : "border-transparent text-text-secondary hover:text-text-primary"
      }`}
    >
      {icon} {label}
    </button>
  );
}

function StatCard({
  label,
  value,
  color,
  bg,
}: {
  label: string;
  value: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`${bg} border border-border-dark rounded-xl p-3`}>
      <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">
        {label}
      </div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function EmptyState({
  direction,
  message,
}: {
  direction: string;
  message: string;
}) {
  const isBuy = direction === "BUY";
  return (
    <div
      className={`border border-dashed ${
        isBuy ? "border-accent-green/20" : "border-accent-red/20"
      } rounded-xl p-8 text-center`}
    >
      <div className="text-4xl mb-3">{isBuy ? "📈" : "📉"}</div>
      <p className="text-text-secondary text-sm">{message}</p>
      <p className="text-text-muted text-xs mt-1">
        Signals appear only when confirmed by multiple indicators
      </p>
    </div>
  );
}

function InfoBox() {
  return (
    <div className="bg-bg-card border border-border-dark rounded-xl p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-2">
        ℹ️ How This Works
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs text-text-secondary">
        <div>
          <div className="font-medium text-text-primary mb-1">Data Source</div>
          <p>
            All prices, OI, and volume data fetched live from Upstox API.
            No synthetic, mock, or simulated data.
          </p>
        </div>
        <div>
          <div className="font-medium text-text-primary mb-1">Momentum Detection</div>
          <p>
            Signals require 3-5 consecutive confirmations across order flow,
            delta, VWAP, volume, OI, and trend before activation.
          </p>
        </div>
        <div>
          <div className="font-medium text-text-primary mb-1">Confidence Score</div>
          <p>
            0-100 score weighted across 7 factors. Only signals with score ≥60
            are displayed. Grades: A+ (90+), A (80+), B+ (70+), B (60+).
          </p>
        </div>
        <div>
          <div className="font-medium text-text-primary mb-1">No Prediction Claims</div>
          <p>
            This tool detects and measures momentum events. It does not predict
            future price or duration. No look-ahead bias.
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import type { HistoricalEvent } from "@/lib/types";

export default function HistoryPanel() {
  const [events, setEvents] = useState<HistoricalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState("");
  const [dirFilter, setDirFilter] = useState<"" | "BUY" | "SELL">("");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.set("date", dateFilter);
      if (dirFilter) params.set("direction", dirFilter);

      const resp = await fetch(`/api/history?${params.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        setEvents(data.events || []);
      }
    } catch {
      // Silent fail
    }
    setLoading(false);
  }, [dateFilter, dirFilter]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const formatTime = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <h2 className="text-lg font-bold text-text-primary">
          📊 Historical Momentum Events
        </h2>
        <div className="flex-1" />
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="bg-bg-input border border-border-dark rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-blue"
        />
        <select
          value={dirFilter}
          onChange={(e) => setDirFilter(e.target.value as "" | "BUY" | "SELL")}
          className="bg-bg-input border border-border-dark rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-blue"
        >
          <option value="">All Directions</option>
          <option value="BUY">BUY Only</option>
          <option value="SELL">SELL Only</option>
        </select>
        <button
          onClick={fetchHistory}
          className="px-3 py-1.5 bg-accent-blue/20 border border-accent-blue/30 text-accent-blue rounded-lg text-sm font-medium hover:bg-accent-blue/30"
        >
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-text-secondary">
          Loading events...
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-text-secondary">No historical events found.</p>
          <p className="text-text-muted text-sm mt-1">
            Momentum events will appear here as they complete during market hours.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-muted text-xs uppercase tracking-wider border-b border-border-dark">
                <th className="pb-2 pr-4">Stock</th>
                <th className="pb-2 pr-4">Dir</th>
                <th className="pb-2 pr-4">Date</th>
                <th className="pb-2 pr-4">Start</th>
                <th className="pb-2 pr-4">End</th>
                <th className="pb-2 pr-4">Duration</th>
                <th className="pb-2 pr-4">Confidence</th>
                <th className="pb-2 pr-4">Grade</th>
                <th className="pb-2 pr-4">Age</th>
                <th className="pb-2 pr-4">MFE</th>
                <th className="pb-2 pr-4">MAE</th>
                <th className="pb-2 pr-4">OI</th>
                <th className="pb-2 pr-4">VWAP</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr
                  key={evt.id}
                  className="border-b border-border-dark/50 hover:bg-bg-card-hover transition-colors"
                >
                  <td className="py-2.5 pr-4 font-semibold text-text-primary">
                    {evt.tradingSymbol}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold ${
                        evt.direction === "BUY"
                          ? "bg-accent-green/20 text-accent-green"
                          : "bg-accent-red/20 text-accent-red"
                      }`}
                    >
                      {evt.direction}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-text-secondary">
                    {formatDate(evt.startTime)}
                  </td>
                  <td className="py-2.5 pr-4 text-text-secondary">
                    {formatTime(evt.startTime)}
                  </td>
                  <td className="py-2.5 pr-4 text-text-secondary">
                    {formatTime(evt.endTime)}
                  </td>
                  <td className="py-2.5 pr-4 text-text-primary font-medium">
                    {evt.durationMinutes
                      ? `${Math.round(evt.durationMinutes)} min`
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-text-primary font-semibold">
                    {evt.confidenceScore?.toFixed(0)}
                  </td>
                  <td className="py-2.5 pr-4">
                    <span className="text-accent-yellow font-bold">
                      {evt.confidenceGrade || "—"}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-text-secondary text-xs">
                    {evt.ageCategory || "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-accent-green text-xs">
                    {evt.maxFavorableExcursion
                      ? `₹${evt.maxFavorableExcursion.toFixed(1)}`
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-accent-red text-xs">
                    {evt.maxAdverseExcursion
                      ? `₹${evt.maxAdverseExcursion.toFixed(1)}`
                      : "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-text-secondary text-xs">
                    {evt.oiBehavior || "—"}
                  </td>
                  <td className="py-2.5 pr-4 text-text-secondary text-xs">
                    {evt.vwapDistance
                      ? `${evt.vwapDistance >= 0 ? "+" : ""}${evt.vwapDistance.toFixed(2)}%`
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

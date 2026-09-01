"use client";

import type { MomentumSignal } from "@/lib/types";

interface MomentumCardProps {
  signal: MomentumSignal;
  rank: number;
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "text-accent-green bg-accent-green/15 border-accent-green/30",
  A: "text-green-400 bg-green-400/15 border-green-400/30",
  "B+": "text-accent-yellow bg-accent-yellow/15 border-accent-yellow/30",
  B: "text-accent-orange bg-accent-orange/15 border-accent-orange/30",
};

const AGE_COLORS: Record<string, string> = {
  Emerging: "text-blue-400",
  Developing: "text-cyan-400",
  Established: "text-accent-green",
  Strong: "text-accent-yellow",
  Extended: "text-accent-orange",
  "Exhaustion Risk": "text-accent-red",
};

export default function MomentumCard({ signal, rank }: MomentumCardProps) {
  const isBuy = signal.direction === "BUY";
  const dirColor = isBuy ? "accent-green" : "accent-red";
  const dirBg = isBuy ? "bg-accent-green/10" : "bg-accent-red/10";
  const dirBorder = isBuy ? "border-accent-green/20" : "border-accent-red/20";
  const glowClass = isBuy ? "glow-green" : "glow-red";

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  const formatDuration = (min: number) => {
    if (min < 1) return "<1 min";
    if (min < 60) return `${Math.round(min)} min`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${h}h ${m}m`;
  };

  return (
    <div
      className={`${dirBg} border ${dirBorder} ${glowClass} rounded-xl p-4 transition-all hover:scale-[1.01]`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-text-primary">
            #{rank}
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-text-primary">
                {signal.tradingSymbol}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-xs font-bold ${
                  isBuy
                    ? "bg-accent-green/20 text-accent-green"
                    : "bg-accent-red/20 text-accent-red"
                }`}
              >
                {signal.direction}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary mt-0.5">
              <span>{formatTime(signal.startTime)} → Now</span>
              <span className="text-text-muted">•</span>
              <span>{formatDuration(signal.durationMinutes)}</span>
            </div>
          </div>
        </div>

        {/* Confidence Badge */}
        <div className="flex flex-col items-end gap-1">
          <span
            className={`px-2.5 py-1 rounded-lg border text-sm font-bold ${
              GRADE_COLORS[signal.confidenceGrade] || GRADE_COLORS["B"]
            }`}
          >
            {signal.confidenceGrade} · {signal.confidenceScore}
          </span>
          <span
            className={`text-xs font-medium ${
              AGE_COLORS[signal.ageCategory] || "text-text-secondary"
            }`}
          >
            {signal.ageCategory}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
        <MetricPill
          label="Price"
          value={`₹${signal.currentPrice.toLocaleString("en-IN", {
            maximumFractionDigits: 2,
          })}`}
        />
        <MetricPill
          label="VWAP"
          value={`${signal.metrics.vwapDistance >= 0 ? "+" : ""}${signal.metrics.vwapDistance.toFixed(2)}%`}
          valueColor={
            signal.metrics.vwapDistance > 0 ? "text-accent-green" : "text-accent-red"
          }
        />
        <MetricPill
          label="OI Chg"
          value={`${signal.metrics.oiChange >= 0 ? "+" : ""}${signal.metrics.oiChange.toFixed(1)}%`}
          valueColor={
            signal.metrics.oiChange > 0 ? "text-accent-green" : "text-accent-red"
          }
        />
        <MetricPill
          label="Volume"
          value={`${signal.metrics.relativeVolume.toFixed(1)}×`}
          valueColor={
            signal.metrics.relativeVolume > 1.5
              ? "text-accent-green"
              : "text-text-primary"
          }
        />
      </div>

      {/* Delta & Order Flow */}
      <div className="flex items-center gap-4 mb-3 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted">Delta:</span>
          <span
            className={
              signal.metrics.cumulativeDelta > 0
                ? "text-accent-green"
                : "text-accent-red"
            }
          >
            {signal.metrics.cumulativeDelta > 0 ? "↑ Rising" : "↓ Falling"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted">OI:</span>
          <span className="text-text-primary">
            {signal.metrics.oiBehavior}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-text-muted">Flow:</span>
          <span className="text-text-primary">
            {signal.metrics.orderFlowScore.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Reasons */}
      <div className="flex flex-wrap gap-1.5">
        {signal.reasons.slice(0, 5).map((reason, i) => (
          <span
            key={i}
            className={`px-2 py-0.5 rounded text-[10px] font-medium ${dirBg} text-${dirColor} border ${dirBorder}`}
          >
            {reason}
          </span>
        ))}
      </div>
    </div>
  );
}

function MetricPill({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="bg-bg-dark/50 rounded-lg px-2.5 py-1.5 text-center">
      <div className="text-[10px] text-text-muted uppercase tracking-wider">
        {label}
      </div>
      <div className={`text-sm font-semibold ${valueColor || "text-text-primary"}`}>
        {value}
      </div>
    </div>
  );
}

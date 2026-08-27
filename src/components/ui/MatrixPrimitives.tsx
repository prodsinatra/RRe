import React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/src/utils";

/**
 * 808 SZN Canonical Wordmark
 * Approved typography: Inter 700, -0.02em tracking, real text
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <Link 
      to="/" 
      aria-label="808 SZN Release Readiness Engine" 
      className={cn(
        "inline-flex items-center group focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-hover rounded-sm",
        className
      )}
    >
      <div className="wordmark-display text-lg font-bold font-display select-none tracking-tight">
        <span className="text-foreground transition-colors group-hover:text-primary-glow">808</span>
        <span className="text-foreground opacity-90 tracking-tighter">SZN</span>
      </div>
    </Link>
  );
}

/**
 * SectionMarker: 01 ── FOUNDATIONS
 */
export function SectionMarker({ 
  idx = "01", 
  label, 
  className = "" 
}: { 
  idx?: string; 
  label: string; 
  className?: string; 
}) {
  return (
    <div className={cn("flex items-center gap-3 select-none", className)}>
      <span className="font-mono text-[11px] tracking-[0.2em] text-primary-glow font-bold">{idx}</span>
      <span className="h-[1px] w-6 bg-border-strong" aria-hidden="true" />
      <span className="font-mono text-[10px] tracking-[0.2em] uppercase text-muted-foreground font-semibold">{label}</span>
    </div>
  );
}

/**
 * SystemRail: 02 ── Catalog sync ──────────────
 */
export function SystemRail({
  idx,
  label,
  className = "",
  rightContent
}: {
  idx?: string;
  label: string;
  className?: string;
  rightContent?: React.ReactNode;
}) {
  return (
    <div className={cn("flex items-center gap-3 py-2 border-y border-border select-none", className)}>
      {idx && <span className="font-mono text-[9px] text-primary-glow tracking-widest">{idx}</span>}
      <span className="system-label font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="flex-1 h-[1px] bg-border min-w-[20px]" aria-hidden="true" />
      {rightContent}
    </div>
  );
}

/**
 * SignalMark: Signal live status with dot + text
 */
export function SignalMark({
  status = "live",
  label,
  tone = "lime",
  className = ""
}: {
  status?: "live" | "pending" | "confirmed" | "blocked" | "processing";
  label?: string;
  tone?: "violet" | "lime" | "amber" | "red";
  className?: string;
}) {
  const displayLabel = label || status.toUpperCase();

  const dotClasses = {
    lime: "bg-accent shadow-[0_0_0_3px_var(--accent-soft)]",
    violet: "bg-primary-glow shadow-[0_0_0_3px_var(--brand-soft)]",
    amber: "bg-warning shadow-[0_0_0_3px_rgba(245,158,11,0.15)]",
    red: "bg-destructive shadow-[0_0_0_3px_rgba(239,68,68,0.15)]",
  }[tone];

  return (
    <span className={cn("inline-flex items-center gap-2 font-mono text-[11px] tracking-wider uppercase text-muted-foreground", className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotClasses)} aria-hidden="true" />
      <span>{displayLabel}</span>
    </span>
  );
}

/**
 * CoordinateLabel: Decorative system telemetry marker (aria-hidden)
 */
export function CoordinateLabel({
  text = "MATRIX // 808 SZN LABS ENGINE",
  className = ""
}: {
  text?: string;
  className?: string;
}) {
  return (
    <div className={cn("system-label text-[9px] text-muted-foreground/60 select-none", className)} aria-hidden="true">
      {text}
    </div>
  );
}

/**
 * WaveSeparator: 32/48-bar audio waveform sweep separator
 */
export function WaveSeparator({ 
  bars = 32, 
  active = false,
  className = "" 
}: { 
  bars?: number; 
  active?: boolean;
  className?: string; 
}) {
  // Pre-calculated rhythmic heights for aesthetic waveform
  const heightPattern = [
    25, 40, 65, 80, 50, 70, 95, 45, 60, 85, 30, 75, 90, 55, 35, 70,
    85, 60, 40, 90, 100, 75, 45, 65, 80, 50, 30, 70, 85, 60, 40, 20
  ];

  return (
    <div 
      className={cn("flex items-end gap-[2px] h-6 overflow-hidden py-0.5 select-none", className)} 
      aria-hidden="true"
    >
      {Array.from({ length: bars }).map((_, i) => {
        const heightPercent = heightPattern[i % heightPattern.length];
        return (
          <span
            key={i}
            className={cn(
              "w-[2px] rounded-[1px] transition-all duration-300",
              active ? "bg-accent shadow-[0_0_8px_var(--accent-border)]" : "bg-border-strong hover:bg-brand-hover"
            )}
            style={{ 
              height: `${heightPercent}%`,
              backgroundImage: active ? "var(--gradient-wave)" : undefined
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * StudioAudioMeter: Professional stereo hardware audio level meter
 */
export function StudioAudioMeter({
  peakL = -4.2,
  peakR = -4.8,
  lufs = -14.1,
  truePeak = -0.8,
  className = ""
}: {
  peakL?: number;
  peakR?: number;
  lufs?: number;
  truePeak?: number;
  className?: string;
}) {
  // Convert dB (-48 to 0) to percentage (0% to 100%)
  const dbToPercent = (db: number) => {
    const clamped = Math.max(-48, Math.min(0, db));
    return Math.round(((clamped + 48) / 48) * 100);
  };

  const pctL = dbToPercent(peakL);
  const pctR = dbToPercent(peakR);
  const isClipped = truePeak > -0.1;

  return (
    <div className={cn("bg-surface border border-border rounded-sm p-3 font-mono text-[10px] space-y-2.5", className)}>
      <div className="flex items-center justify-between border-b border-border pb-1.5 text-muted-foreground">
        <span className="uppercase font-bold tracking-wider text-[9px] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          Hardware True Peak Meter
        </span>
        <div className="flex items-center gap-2 tabular-nums">
          <span className="text-muted-foreground">LUFS: <strong className="text-foreground">{lufs.toFixed(1)}</strong></span>
          <span>•</span>
          <span className={isClipped ? "text-destructive font-bold" : "text-emerald-400 font-bold"}>
            TP: {truePeak > 0 ? `+${truePeak.toFixed(1)}` : truePeak.toFixed(1)} dB
          </span>
        </div>
      </div>

      {/* L Channel */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
          <span>CH 1 (L)</span>
          <span className="tabular-nums text-foreground">{peakL.toFixed(1)} dBFS</span>
        </div>
        <div className="h-2 w-full bg-surface-raised rounded-none overflow-hidden flex border border-border/50">
          <div 
            className="h-full transition-all duration-100 ease-out"
            style={{ 
              width: `${pctL}%`,
              background: pctL > 90 
                ? "linear-gradient(90deg, #10b981 0%, #f59e0b 70%, #ef4444 100%)" 
                : pctL > 70 
                ? "linear-gradient(90deg, #10b981 0%, #f59e0b 100%)" 
                : "#10b981"
            }}
          />
        </div>
      </div>

      {/* R Channel */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[9px] text-muted-foreground">
          <span>CH 2 (R)</span>
          <span className="tabular-nums text-foreground">{peakR.toFixed(1)} dBFS</span>
        </div>
        <div className="h-2 w-full bg-surface-raised rounded-none overflow-hidden flex border border-border/50">
          <div 
            className="h-full transition-all duration-100 ease-out"
            style={{ 
              width: `${pctR}%`,
              background: pctR > 90 
                ? "linear-gradient(90deg, #10b981 0%, #f59e0b 70%, #ef4444 100%)" 
                : pctR > 70 
                ? "linear-gradient(90deg, #10b981 0%, #f59e0b 100%)" 
                : "#10b981"
            }}
          />
        </div>
      </div>

      {/* dB Scale Markings */}
      <div className="flex justify-between text-[8px] text-muted-foreground/60 px-0.5 pt-0.5 tabular-nums border-t border-border/40">
        <span>-48</span>
        <span>-36</span>
        <span>-24</span>
        <span>-18</span>
        <span>-12</span>
        <span>-6</span>
        <span className="text-warning">-3</span>
        <span className="text-destructive font-bold">0</span>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { ReadinessProject, ProjectEvent } from "../../types";
import { useRealtime } from "../../contexts/RealtimeContext";
import { SectionMarker, SystemRail, SignalMark, CoordinateLabel } from "../ui/MatrixPrimitives";
import { StateChip } from "../ui/badge";
import { getStatusColor } from "../../lib/utils";
import { Terminal, ArrowRight, Clock, Hash, CheckCircle2, ShieldCheck, Activity } from "lucide-react";

export function ActivityPage() {
  const { project, reloadProject } = useOutletContext<{ project: ReadinessProject, reloadProject: () => void }>();
  const { subscribeToEvents, status, latencyMs } = useRealtime();
  const [liveEvents, setLiveEvents] = useState<ProjectEvent[]>(project.events || []);

  useEffect(() => {
    setLiveEvents(project.events || []);
  }, [project.events]);

  useEffect(() => {
    const unsub = subscribeToEvents(project.id, (newEvent: ProjectEvent) => {
      setLiveEvents((prev) => {
        if (prev.some((e) => e.id === newEvent.id)) return prev;
        return [newEvent, ...prev];
      });
      reloadProject();
    });

    return () => unsub();
  }, [project.id, subscribeToEvents, reloadProject]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <SectionMarker idx="09" label="Tamper-Evident Audit Ledger" />
          <h2 className="text-2xl font-bold font-display tracking-tight text-foreground mt-2">
            Live Telemetry Stream
          </h2>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-wider mt-1">
            Deterministic state transitions &bull; Real-time cryptographic ledger &bull; Zero latency sync
          </p>
        </div>

        <div className="flex items-center gap-4">
          <SignalMark 
            status={status === "connected" ? "live" : "pending"} 
            label={status === "connected" ? `STREAM ACTIVE (${latencyMs}ms)` : "OFFLINE"} 
            tone={status === "connected" ? "lime" : "amber"} 
          />
          <CoordinateLabel text="LEDGER // APPEND-ONLY" />
        </div>
      </div>

      {/* Events Stream Panel */}
      <div className="surface-panel p-6 sm:p-8 space-y-6">
        <SystemRail 
          idx="09.A" 
          label="Sequence Log" 
          rightContent={
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {liveEvents.length} {liveEvents.length === 1 ? "Record" : "Records"}
            </span>
          }
        />

        {liveEvents.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground font-mono text-xs space-y-2">
            <Activity className="w-8 h-8 mx-auto opacity-40 animate-pulse text-primary-glow" />
            <p className="uppercase tracking-wider">No audit telemetry recorded yet</p>
            <p className="text-muted-foreground/60">Actions performed by connected studio operators will stream here live.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {liveEvents.map((event, i) => {
              const isLatest = i === 0;
              return (
                <div
                  key={event.id}
                  className={`surface-panel p-4 sm:p-5 transition-all relative overflow-hidden ${
                    isLatest ? "border-brand-border bg-surface-raised/80 hairline-top" : ""
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground bg-primary/20 text-primary-glow border border-brand-border px-2.5 py-0.5 rounded-sm">
                        {event.eventType}
                      </span>
                      {isLatest && (
                        <span className="bg-accent-soft border border-accent-border text-accent font-mono text-[10px] font-bold px-2 py-0.5 rounded-sm animate-pulse">
                          LATEST
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground tabular-nums">
                      <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>{new Date(event.createdAt).toLocaleTimeString()}</span>
                      <span className="opacity-40">&bull;</span>
                      <span className="opacity-70">{new Date(event.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono pt-2 border-t border-border">
                    <div className="space-y-1">
                      <span className="text-muted-foreground uppercase text-[10px] tracking-wider">Operator Identity</span>
                      <div className="font-semibold text-foreground flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-primary-glow" />
                        <span>{event.actorId}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-surface rounded-sm text-muted-foreground uppercase border border-border">
                          {event.actorRole}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <span className="text-muted-foreground uppercase text-[10px] tracking-wider">State Transition</span>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground uppercase">{event.previousState}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-primary-glow shrink-0" />
                        <span className="font-bold text-foreground uppercase">{event.nextState}</span>
                      </div>
                    </div>
                  </div>

                  {event.payloadDigest && (
                    <div className="mt-3 pt-3 border-t border-border flex items-center gap-2 text-[10px] font-mono text-muted-foreground">
                      <Hash className="w-3 h-3 text-primary-glow shrink-0" />
                      <span className="truncate">Digest: <strong className="text-foreground">{event.payloadDigest}</strong></span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

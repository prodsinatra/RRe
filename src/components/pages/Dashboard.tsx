import { useState, useEffect } from "react";
import { ReadinessProject } from "../../types";
import { Link } from "react-router-dom";
import { StateChip } from "../ui/badge";
import { getStatusColor } from "../../lib/utils";
import { Button } from "../ui/button";
import { useRealtime } from "../../contexts/RealtimeContext";
import { useStore } from "../../lib/store";
import { SectionMarker, SystemRail, WaveSeparator, SignalMark, CoordinateLabel } from "../ui/MatrixPrimitives";
import { Radio, Plus, Activity, Layers, FileCheck, ArrowRight, ShieldCheck } from "lucide-react";

export function Dashboard() {
  const { projects, loading, fetchProjects } = useStore();
  const { subscribeToProjectList, status, latencyMs } = useRealtime();

  useEffect(() => {
    fetchProjects();
    const unsub = subscribeToProjectList(() => {
      fetchProjects();
    });
    return () => unsub();
  }, [subscribeToProjectList, fetchProjects]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <WaveSeparator active={true} bars={24} />
        <div className="text-muted-foreground text-xs font-mono tracking-widest uppercase">
          Initializing Engine Telemetry...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Masthead Hero Canvas */}
      <div className="surface-panel p-8 md:p-10 relative overflow-hidden hairline-top">
        <div className="flex flex-col gap-6 relative z-10">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-5">
            <div className="flex items-center gap-3">
              <span className="dot" aria-hidden="true"></span>
              <span className="text-eyebrow">808 SZN Engine &middot; Studio Operations v2.1</span>
            </div>
            
            <div className="flex items-center gap-4">
              <SignalMark 
                status={status === "connected" ? "live" : "pending"} 
                label={status === "connected" ? `WS SYNC ACTIVE (${latencyMs}ms)` : "OFFLINE"} 
                tone={status === "connected" ? "lime" : "amber"} 
              />
              <CoordinateLabel text="MATRIX // 08:26 · RELEASE READINESS" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-end">
            <div className="lg:col-span-2 space-y-3">
              <h1 className="text-3xl md:text-5xl font-bold font-display tracking-tight text-foreground leading-[1.08]">
                Release Readiness Engine
              </h1>
              <p className="text-muted-foreground text-sm md:text-base max-w-2xl leading-relaxed">
                Deterministic pre-release validation for modern music makers. Ingest audio masters, verify 100.00% split schemas, audit legal attestation, and cryptographically seal delivery manifests.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:justify-end">
              <Button variant="hero" asChild className="font-mono text-xs uppercase tracking-wider">
                <Link to="/readiness/new" className="flex items-center justify-center gap-2">
                  <Plus className="w-4 h-4" />
                  New Session
                </Link>
              </Button>
              <Button variant="quiet" asChild className="font-mono text-xs uppercase tracking-wider">
                <Link to="/settings/policies">
                  Rule Policies
                </Link>
              </Button>
            </div>
          </div>

          <div className="pt-2">
            <WaveSeparator active={true} bars={48} className="opacity-75" />
          </div>
        </div>
      </div>

      {/* Quick Matrix Telemetry Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface-panel p-5 space-y-1.5">
          <div className="flex items-center justify-between text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
            <span>Total Staged Sessions</span>
            <Layers className="w-3.5 h-3.5 text-primary-glow" />
          </div>
          <div className="text-2xl font-bold font-display text-foreground tabular-nums">
            {projects.length}
          </div>
          <p className="text-[11px] font-mono text-muted-foreground">
            Synchronized with local and cloud records
          </p>
        </div>

        <div className="surface-panel p-5 space-y-1.5">
          <div className="flex items-center justify-between text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
            <span>Policy Validations</span>
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-display text-emerald-400 tabular-nums">
            {projects.filter(p => p.state === "approved" || p.state === "ready_for_approval").length}
          </div>
          <p className="text-[11px] font-mono text-muted-foreground">
            Passed deterministic split &amp; audio checks
          </p>
        </div>

        <div className="surface-panel p-5 space-y-1.5">
          <div className="flex items-center justify-between text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
            <span>Active Blockers</span>
            <Activity className="w-3.5 h-3.5 text-destructive" />
          </div>
          <div className="text-2xl font-bold font-display text-destructive tabular-nums">
            {projects.filter(p => p.state === "blocked" || p.findings?.some(f => f.severity === "blocked")).length}
          </div>
          <p className="text-[11px] font-mono text-muted-foreground">
            Require operator or approver intervention
          </p>
        </div>
      </div>

      {/* Active Sessions Grid */}
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <SectionMarker idx="01" label="Active Release Sessions" />
          <span className="font-mono text-xs text-muted-foreground tabular-nums">
            {projects.length} {projects.length === 1 ? "Session" : "Sessions"}
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {projects.map((proj, idx) => {
            const hasBlocked = proj.state === "blocked" || proj.findings?.some(f => f.severity === "blocked");
            return (
              <Link 
                key={proj.id} 
                to={`/readiness/${proj.id}/overview`}
                className={`group flex flex-col justify-between surface-panel p-6 min-h-[180px] transition-all hover:border-brand-border active:translate-y-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-hover relative overflow-hidden ${
                  hasBlocked ? "hover:border-destructive/60" : ""
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <StateChip variant={getStatusColor(proj.state) as any}>
                      {proj.state.replace(/_/g, ' ')}
                    </StateChip>
                    <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
                      <span className="opacity-40">[{String(idx + 1).padStart(2, "0")}]</span>
                      <span className="bg-surface px-2 py-0.5 rounded border border-border tabular-nums font-bold text-foreground">
                        REV {proj.revision}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-display font-semibold text-lg md:text-xl text-foreground group-hover:text-primary-glow transition-colors tracking-tight">
                      {proj.title}
                    </h3>
                    <p className="text-muted-foreground font-mono text-xs mt-1 uppercase tracking-wider">
                      {proj.primaryArtist} &bull; {proj.assets?.length || 0} Assets &bull; {proj.credits?.length || 0} Contributors
                    </p>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-border flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span className="tabular-nums">Target: {proj.targetDate || "Unscheduled"}</span>
                  <span className="flex items-center gap-1 text-foreground group-hover:text-primary-glow font-bold transition-colors">
                    Open Session <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </Link>
            );
          })}
          
          {projects.length === 0 && (
            <div className="surface-panel p-12 text-center text-muted-foreground font-mono text-sm col-span-full border-dashed">
              No active sessions found. Click &quot;New Session&quot; to initialize a release manifest.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


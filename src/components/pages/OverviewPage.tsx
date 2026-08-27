import { useOutletContext, Link } from "react-router-dom";
import { ReadinessProject } from "../../types";
import { SectionMarker, SystemRail, SignalMark, WaveSeparator } from "../ui/MatrixPrimitives";
import { Disc3, Calendar, Users, HardDrive, ShieldAlert, Cpu, Sparkles, ArrowRight } from "lucide-react";

export function OverviewPage() {
  const { project } = useOutletContext<{ project: ReadinessProject }>();

  const isBlocked = project.findings.some(f => f.severity === "blocked" && f.status === "unresolved");
  const warningsCount = project.findings.filter(f => f.severity === "needs_review" && f.status === "unresolved").length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="border-b border-border pb-6">
        <SectionMarker idx="01" label="Release Overview & System State" />
        <h2 className="text-2xl font-bold font-display tracking-tight text-foreground mt-2">
          {project.title}
        </h2>
        <p className="text-muted-foreground font-mono text-xs uppercase tracking-wider mt-1">
          Catalog ID: {project.id} &bull; Primary Artist: {project.primaryArtist} &bull; Revision: {project.revision}
        </p>
      </div>

      {/* Snapshot Cards */}
      <div className="space-y-4">
        <SystemRail 
          idx="01.A" 
          label="Operational Metrics" 
          rightContent={
            <SignalMark 
              status={isBlocked ? "pending" : "confirmed"} 
              label={isBlocked ? "ACTION REQUIRED" : "ALL SYSTEMS NOMINAL"} 
              tone={isBlocked ? "amber" : "lime"} 
            />
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="surface-panel p-5 space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary-glow" /> Target Date
            </span>
            <div className="font-mono text-base font-bold text-foreground tabular-nums">
              {project.targetDate || "Unscheduled"}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">Target Ingestion Window</div>
          </div>

          <div className="surface-panel p-5 space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-accent" /> Master Assets
            </span>
            <div className="font-mono text-base font-bold text-foreground tabular-nums">
              {project.assets.length} Files Staged
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              {project.assets.filter(a => a.assetType === "master").length} Master &bull; {project.assets.filter(a => a.assetType === "instrumental").length} Inst
            </div>
          </div>

          <div className="surface-panel p-5 space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-primary-glow" /> Credits Ledger
            </span>
            <div className="font-mono text-base font-bold text-foreground tabular-nums">
              {project.credits.length} Contributors
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">Royalty Splits Configured</div>
          </div>

          <div className="surface-panel p-5 space-y-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <ShieldAlert className={`w-3.5 h-3.5 ${isBlocked ? "text-destructive" : "text-emerald-400"}`} /> Evaluation State
            </span>
            <div className={`font-mono text-base font-bold uppercase tabular-nums ${isBlocked ? "text-destructive" : "text-accent"}`}>
              {isBlocked ? "Hard Blockers" : warningsCount > 0 ? "Needs Review" : "Pass / Ready"}
            </div>
            <div className="text-[11px] font-mono text-muted-foreground">
              {project.findings.length} Policy checks evaluated
            </div>
          </div>
        </div>
      </div>

      <WaveSeparator />

      {/* Navigation Quickjump Grid */}
      <div className="space-y-4">
        <SystemRail idx="01.B" label="Stage Verification Sequence" />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link 
            to={`/readiness/${project.id}/metadata`} 
            className="surface-panel p-5 hover:border-brand-border transition-all flex flex-col justify-between group"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">[02] METADATA</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary-glow group-hover:translate-x-0.5 transition-all" />
              </div>
              <h4 className="font-display font-bold text-sm text-foreground">Catalog Identifiers</h4>
              <p className="text-xs font-mono text-muted-foreground">Review release titles, PAL tags, and target ingestion windows.</p>
            </div>
          </Link>

          <Link 
            to={`/readiness/${project.id}/assets`} 
            className="surface-panel p-5 hover:border-brand-border transition-all flex flex-col justify-between group"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">[04] ASSETS</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary-glow group-hover:translate-x-0.5 transition-all" />
              </div>
              <h4 className="font-display font-bold text-sm text-foreground">Audio Signal Diagnostics</h4>
              <p className="text-xs font-mono text-muted-foreground">Inspect waveforms, True Peak dbFS, and LUFS compliance.</p>
            </div>
          </Link>

          <Link 
            to={`/readiness/${project.id}/review`} 
            className="surface-panel p-5 hover:border-brand-border transition-all flex flex-col justify-between group"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">[07] REVIEW</span>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary-glow group-hover:translate-x-0.5 transition-all" />
              </div>
              <h4 className="font-display font-bold text-sm text-foreground">Authorization Gate</h4>
              <p className="text-xs font-mono text-muted-foreground">Trigger AI summary analysis and execute cryptographic sign-off.</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

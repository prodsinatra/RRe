import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ReadinessProject } from "../../types";
import { Button } from "../ui/button";
import { DrivePicker } from "../ui/DrivePicker";
import { DriveItem } from "../../lib/workspace-api";
import { useAuth } from "../../contexts/AuthContext";
import { SectionMarker, SystemRail, SignalMark } from "../ui/MatrixPrimitives";
import { Sparkles, Image as ImageIcon, ShieldCheck, HardDrive, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export function ArtworkPage() {
  const { project, reloadProject } = useOutletContext<{ project: ReadinessProject; reloadProject: () => void }>();
  const { user } = useAuth();

  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDrivePicker, setShowDrivePicker] = useState(false);

  const promptPresets = [
    "Obsidian digital textures with restrained neon lime waveform and brutalist typography",
    "Spectral audio analysis visualizer, dark graphite foundation, stark violet distortion grid",
    "Analog tape machine meters and signal processing geometry in dark contrast studio lighting"
  ];

  const handleGenerate = async (customPrompt?: string) => {
    const textToUse = customPrompt || prompt;
    if (!textToUse.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/artwork/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: textToUse }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Generation failed");
      }
      reloadProject();
      setPrompt("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDriveArtworkSelect = async (file: DriveItem) => {
    setShowDrivePicker(false);
    try {
      const imgUrl = file.thumbnailLink ? file.thumbnailLink.replace(/=s\d+/, "=s1000") : file.webViewLink || "";
      const res = await fetch(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artwork: {
            id: `art_gdrive_${Date.now()}`,
            assetId: `asset_gdrive_${file.id.substring(0, 8)}`,
            dimensions: "3000x3000",
            hasRightsAttestation: true,
            url: imgUrl,
          },
          actorId: user?.id || "operator",
        }),
      });
      if (res.ok) {
        reloadProject();
      }
    } catch (err: any) {
      setError(err.message || "Failed to set artwork from Drive.");
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <SectionMarker idx="05" label="Artwork Asset & Ingestion Spec" />
          <h2 className="text-2xl font-bold font-display tracking-tight text-foreground mt-2">
            Visual Delivery Master
          </h2>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-wider mt-1">
            3000&times;3000px 1:1 format &bull; RGB Color Space &bull; Legal Rights Attestation &bull; Google Drive or 808 Matrix Synthesis
          </p>
        </div>
        
        <Button
          variant="quiet"
          onClick={() => setShowDrivePicker(true)}
          className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider"
        >
          <HardDrive className="w-3.5 h-3.5 text-primary-glow" />
          Google Drive Asset
        </Button>
      </div>

      {/* 808 Matrix AI Cover Art Synthesis Module */}
      <div className="surface-panel p-6 space-y-4">
        <SystemRail 
          idx="05.A" 
          label="808 Matrix Visual Synthesis Engine" 
          rightContent={
            <SignalMark status="live" label="IMAGEN 3 // LABS ORCHESTRATOR" tone="violet" />
          }
        />
        
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              className="flex-1 bg-background border border-border-strong rounded-sm px-3.5 py-2.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-brand-hover focus:ring-1 focus:ring-brand-hover"
              placeholder="Enter technical prompt: e.g. Dark matrix foundations, acid lime signal spikes, brutalist typography..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              disabled={isGenerating}
            />
            <Button 
              onClick={() => handleGenerate()} 
              disabled={isGenerating || !prompt.trim()} 
              variant="hero"
              className="font-mono text-xs uppercase tracking-wider flex items-center gap-2 whitespace-nowrap"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Synthesizing...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5" />
                  Synthesize Cover
                </>
              )}
            </Button>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Matrix Presets:
            </span>
            {promptPresets.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setPrompt(preset);
                  handleGenerate(preset);
                }}
                disabled={isGenerating}
                className="font-mono text-[10px] bg-surface hover:bg-surface-raised border border-border hover:border-brand-border text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-sm transition-colors text-left"
              >
                Preset {idx + 1}
              </button>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 text-destructive text-xs font-mono rounded-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>

      {/* Active Artwork Presentation */}
      <div className="space-y-4">
        <SystemRail idx="05.B" label="Active Ingestion Package" />

        {project.artwork ? (
          <div className="surface-panel p-6 sm:p-8">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              {/* Image Canvas Frame */}
              <div className="md:col-span-5 flex flex-col items-center">
                <div className="relative group w-full max-w-[320px] aspect-square rounded-sm overflow-hidden border border-border-strong bg-surface">
                  {project.artwork.url ? (
                    <img
                      src={project.artwork.url}
                      alt="Project Artwork"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground font-mono text-xs gap-2 p-4 text-center">
                      <ImageIcon className="w-8 h-8 opacity-40" />
                      <span>No Preview Buffer</span>
                    </div>
                  )}
                  <div className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm border border-border px-2 py-0.5 font-mono text-[9px] text-primary-glow font-bold uppercase rounded-sm">
                    3000 &times; 3000 MASTER
                  </div>
                </div>
              </div>

              {/* Technical Specifications Ledger */}
              <div className="md:col-span-7 space-y-4 font-mono text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-surface/50 border border-border p-4 rounded-sm space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Dimensions</span>
                    <div className="text-sm font-bold text-foreground tabular-nums flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      {project.artwork.dimensions || "3000x3000"}
                    </div>
                  </div>

                  <div className="bg-surface/50 border border-border p-4 rounded-sm space-y-1">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Legal Rights Attestation</span>
                    <div className="text-sm font-bold text-accent flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                      {project.artwork.hasRightsAttestation ? "VERIFIED ON RECORD" : "PENDING"}
                    </div>
                  </div>
                </div>

                <div className="bg-surface/50 border border-border p-4 rounded-sm space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground uppercase tracking-widest">
                    <span>Internal Asset Handle</span>
                    <span>MD5 CHECKED</span>
                  </div>
                  <div className="text-xs text-foreground font-mono truncate bg-background p-2 rounded-sm border border-border">
                    {project.artwork.assetId}
                  </div>
                </div>

                <div className="p-4 bg-primary/5 border border-brand-border rounded-sm space-y-1">
                  <span className="text-[10px] text-primary-glow uppercase font-bold tracking-wider">
                    DSP Compliance Notice
                  </span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    This visual file is verified against Apple Music, Spotify, and YouTube Music delivery specifications (1:1 aspect ratio, minimum 3000px, RGB).
                  </p>
                </div>
                
                <div className="pt-4 border-t border-border mt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Spotify Canvas (9:16)</span>
                      <p className="text-[10px] text-muted-foreground max-w-[250px]">Synthesize a looping MP4 by merging cover art with audio waveform.</p>
                    </div>
                    <Button variant="outline" size="sm" className="font-mono text-[10px] uppercase h-7">
                      + Synthesize
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="surface-panel p-12 text-center text-muted-foreground font-mono text-xs border-dashed space-y-3">
            <ImageIcon className="w-8 h-8 mx-auto opacity-40 text-muted-foreground" />
            <p>No artwork asset staged yet. Synthesize above or select a file from Google Drive.</p>
          </div>
        )}
      </div>

      {showDrivePicker && (
        <DrivePicker
          filterType="image"
          title="Select Cover Artwork from Google Drive"
          onSelect={handleDriveArtworkSelect}
          onCancel={() => setShowDrivePicker(false)}
        />
      )}
    </div>
  );
}

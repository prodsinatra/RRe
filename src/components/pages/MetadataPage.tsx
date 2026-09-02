import { fetchApi } from "../../lib/fetchApi";
import { useState, useEffect } from "react";
import { useOutletContext } from "react-router-dom";
import { ReadinessProject, ReleaseMetadata } from "../../types";
import { Button } from "../ui/button";
import { useAuth } from "../../contexts/AuthContext";
import { useRealtime } from "../../contexts/RealtimeContext";
import { FieldPresenceIndicator } from "../telemetry/FieldPresenceIndicator";
import { SectionMarker, SystemRail } from "../ui/MatrixPrimitives";
import { Edit3, CheckCircle2, AlertTriangle, Disc3, Calendar, Users, Music } from "lucide-react";

export function MetadataPage() {
  const { project, reloadProject } = useOutletContext<{ project: ReadinessProject, reloadProject: () => void }>();
  const { user } = useAuth();
  const { updatePresence } = useRealtime();
  
  const [formData, setFormData] = useState<ReleaseMetadata>({
    title: "",
    primaryArtist: "",
    featuredArtists: [],
    explicitContent: false,
    targetDate: "",
    isrc: "",
    upc: ""
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setFormData(project.metadata);
    }
  }, [project]);

  const handleFieldFocus = (fieldName: string) => {
    updatePresence("metadata", fieldName);
  };

  const handleFieldBlur = () => {
    updatePresence("metadata", undefined);
  };

  const handleMintCodes = () => {
    if (!isEditing) return;
    const randomIsrc = `US-808-${new Date().getFullYear().toString().substring(2)}-${Math.floor(Math.random() * 90000 + 10000)}`;
    const randomUpc = `19${Math.floor(Math.random() * 9000000000 + 1000000000)}`;
    setFormData(prev => ({ ...prev, isrc: randomIsrc, upc: randomUpc }));
    updatePresence("metadata", "Minted Global Identifiers");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetchApi(`/api/projects/${project.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          metadata: formData,
          title: formData.title,
          primaryArtist: formData.primaryArtist,
          actorId: user?.id,
          actorRole: user?.role
        })
      });
      if (res.ok) {
        setIsEditing(false);
        updatePresence("metadata", undefined, "Saved metadata updates");
        reloadProject();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <SectionMarker idx="02" label="Release Identity & Taxonomy" />
          <h2 className="text-2xl font-bold font-display tracking-tight text-foreground mt-2">
            Metadata Specifications
          </h2>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-wider mt-1">
            Global catalog identifiers &amp; distribution targets synced live across studio clients.
          </p>
        </div>
        
        <div>
          {!isEditing ? (
            <Button 
              variant="quiet" 
              onClick={() => { setIsEditing(true); updatePresence("metadata", "Editing Form"); }}
              className="font-mono text-xs uppercase tracking-wider flex items-center gap-2"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Metadata
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                onClick={() => { setIsEditing(false); setFormData(project.metadata); updatePresence("metadata", undefined); }}
                className="font-mono text-xs uppercase tracking-wider"
              >
                Cancel
              </Button>
              <Button 
                variant="hero" 
                onClick={handleSave} 
                disabled={isSaving}
                className="font-mono text-xs uppercase tracking-wider flex items-center gap-2"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                {isSaving ? "Broadcasting..." : "Save & Broadcast"}
              </Button>
            </div>
          )}
        </div>
      </div>
      
      <div className="surface-panel p-6 sm:p-8 space-y-6">
        <SystemRail 
          idx="02.A" 
          label="Identity Specifications" 
          rightContent={
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              Revision {project.revision}
            </span>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Release Title */}
          <div className="space-y-2 bg-surface/50 border border-border p-4 rounded-sm">
            <div className="flex items-center justify-between text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><Disc3 className="w-3 h-3 text-primary-glow" /> Release Title</span>
              <span className="text-primary-glow font-bold">*REQUIRED</span>
            </div>
            {isEditing ? (
              <div>
                <input 
                  className="w-full bg-background border border-border-strong rounded-sm px-3 py-2 text-sm text-foreground font-medium focus:outline-none focus:border-brand-hover focus:ring-1 focus:ring-brand-hover"
                  value={formData.title} 
                  onFocus={() => handleFieldFocus("Release Title")}
                  onBlur={handleFieldBlur}
                  onChange={e => setFormData({ ...formData, title: e.target.value })} 
                  placeholder="e.g. ULTRA_VIOLET_808"
                />
                <FieldPresenceIndicator fieldName="Release Title" />
              </div>
            ) : (
              <div>
                <div className="font-display font-semibold text-lg text-foreground">{project.metadata.title || "—"}</div>
                <FieldPresenceIndicator fieldName="Release Title" />
              </div>
            )}
          </div>
          
          {/* Primary Artist */}
          <div className="space-y-2 bg-surface/50 border border-border p-4 rounded-sm">
            <div className="flex items-center justify-between text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><Users className="w-3 h-3 text-primary-glow" /> Primary Artist</span>
              <span className="text-primary-glow font-bold">*REQUIRED</span>
            </div>
            {isEditing ? (
              <div>
                <input 
                  className="w-full bg-background border border-border-strong rounded-sm px-3 py-2 text-sm text-foreground font-medium focus:outline-none focus:border-brand-hover focus:ring-1 focus:ring-brand-hover"
                  value={formData.primaryArtist} 
                  onFocus={() => handleFieldFocus("Primary Artist")}
                  onBlur={handleFieldBlur}
                  onChange={e => setFormData({ ...formData, primaryArtist: e.target.value })} 
                  placeholder="e.g. 808 SZN Labs"
                />
                <FieldPresenceIndicator fieldName="Primary Artist" />
              </div>
            ) : (
              <div>
                <div className="font-display font-semibold text-lg text-foreground">{project.metadata.primaryArtist || "—"}</div>
                <FieldPresenceIndicator fieldName="Primary Artist" />
              </div>
            )}
          </div>
          
          {/* Featured Artists */}
          <div className="space-y-2 bg-surface/50 border border-border p-4 rounded-sm">
            <div className="flex items-center justify-between text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><Music className="w-3 h-3 text-primary-glow" /> Featured Artists</span>
              <span className="text-muted-foreground">OPTIONAL</span>
            </div>
            {isEditing ? (
              <div>
                <input 
                  className="w-full bg-background border border-border-strong rounded-sm px-3 py-2 text-sm text-foreground focus:outline-none focus:border-brand-hover focus:ring-1 focus:ring-brand-hover"
                  value={formData.featuredArtists?.join(", ") || ""} 
                  onFocus={() => handleFieldFocus("Featured Artists")}
                  onBlur={handleFieldBlur}
                  onChange={e => setFormData({ ...formData, featuredArtists: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} 
                  placeholder="Artist 1, Artist 2"
                />
                <FieldPresenceIndicator fieldName="Featured Artists" />
              </div>
            ) : (
              <div>
                <div className="font-medium text-foreground">{project.metadata.featuredArtists?.length > 0 ? project.metadata.featuredArtists.join(", ") : "None"}</div>
                <FieldPresenceIndicator fieldName="Featured Artists" />
              </div>
            )}
          </div>
          
          {/* Target Date */}
          <div className="space-y-2 bg-surface/50 border border-border p-4 rounded-sm">
            <div className="flex items-center justify-between text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
              <span className="flex items-center gap-1.5"><Calendar className="w-3 h-3 text-primary-glow" /> Target Ingestion Date</span>
              <span className="font-mono text-[9px] text-muted-foreground">YYYY-MM-DD</span>
            </div>
            {isEditing ? (
              <div>
                <input 
                  className="w-full bg-background border border-border-strong rounded-sm px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-brand-hover focus:ring-1 focus:ring-brand-hover tabular-nums"
                  value={formData.targetDate || ""} 
                  onFocus={() => handleFieldFocus("Target Date")}
                  onBlur={handleFieldBlur}
                  onChange={e => setFormData({ ...formData, targetDate: e.target.value })} 
                  placeholder="2026-10-31"
                />
                <FieldPresenceIndicator fieldName="Target Date" />
              </div>
            ) : (
              <div>
                <div className="font-mono text-sm text-foreground tabular-nums">{project.metadata.targetDate || "Unscheduled"}</div>
                <FieldPresenceIndicator fieldName="Target Date" />
              </div>
            )}
          </div>

          {/* ISRC / UPC Minting Block */}
          <div className="md:col-span-2 space-y-4 bg-surface/50 border border-border p-4 rounded-sm">
            <div className="flex items-center justify-between text-muted-foreground font-mono text-[10px] uppercase tracking-wider border-b border-border pb-2">
              <span className="flex items-center gap-1.5"><Disc3 className="w-3 h-3 text-primary-glow" /> Supply Chain Registry</span>
              {isEditing && (
                <Button variant="quiet" size="sm" onClick={handleMintCodes} className="h-6 text-[10px] uppercase tracking-wider font-mono">
                  Auto-Mint ISRC/UPC
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* UPC */}
              <div className="space-y-1">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">UPC (Universal Product Code)</span>
                {isEditing ? (
                  <input 
                    className="w-full bg-background border border-border-strong rounded-sm px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-brand-hover focus:ring-1 focus:ring-brand-hover tabular-nums"
                    value={formData.upc || ""} 
                    onFocus={() => handleFieldFocus("UPC")}
                    onBlur={handleFieldBlur}
                    onChange={e => setFormData({ ...formData, upc: e.target.value })} 
                    placeholder="e.g. 192837465012"
                  />
                ) : (
                  <div className="font-mono text-sm font-bold text-foreground tabular-nums">{project.metadata.upc || "PENDING MINT"}</div>
                )}
                <FieldPresenceIndicator fieldName="UPC" />
              </div>

              {/* ISRC */}
              <div className="space-y-1">
                <span className="font-mono text-[10px] text-muted-foreground uppercase">ISRC (Recording Code)</span>
                {isEditing ? (
                  <input 
                    className="w-full bg-background border border-border-strong rounded-sm px-3 py-2 text-sm text-foreground font-mono focus:outline-none focus:border-brand-hover focus:ring-1 focus:ring-brand-hover tabular-nums uppercase"
                    value={formData.isrc || ""} 
                    onFocus={() => handleFieldFocus("ISRC")}
                    onBlur={handleFieldBlur}
                    onChange={e => setFormData({ ...formData, isrc: e.target.value })} 
                    placeholder="e.g. US-808-26-10293"
                  />
                ) : (
                  <div className="font-mono text-sm font-bold text-foreground tabular-nums">{project.metadata.isrc || "PENDING MINT"}</div>
                )}
                <FieldPresenceIndicator fieldName="ISRC" />
              </div>
            </div>
          </div>

          {/* Explicit Content Toggle */}
          <div className="md:col-span-2 space-y-2 bg-surface/50 border border-border p-4 rounded-sm">
            <div className="flex items-center justify-between text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
              <span>Parental Advisory Flag</span>
              <span className="font-mono text-[9px] text-muted-foreground">DSP INGESTION ATTRIBUTE</span>
            </div>
            {isEditing ? (
              <label className="flex items-center gap-3 cursor-pointer py-1 select-none">
                <input 
                  type="checkbox" 
                  checked={formData.explicitContent}
                  onChange={e => setFormData({ ...formData, explicitContent: e.target.checked })}
                  className="w-4 h-4 rounded-none border-border-strong bg-background text-primary focus:ring-brand-hover"
                />
                <span className="text-sm font-medium text-foreground">Contains explicit lyrical or audio content (PAL flag enabled)</span>
              </label>
            ) : (
              <div className="font-mono text-xs text-foreground uppercase tracking-wider">
                {project.metadata.explicitContent ? (
                  <span className="text-accent font-bold">Explicit (Advisory Tagged)</span>
                ) : (
                  <span className="text-muted-foreground">Clean / Non-Explicit</span>
                )}
              </div>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="flex items-start gap-3 p-4 border border-warning/40 bg-warning/10 text-warning-foreground text-xs font-mono rounded-sm">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-warning" />
            <div>
              <strong className="uppercase">State Machine Notice:</strong> Material changes to release titles or artist entities broadcast in real time to connected room operators and will revoke any pending cryptographic sign-offs.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

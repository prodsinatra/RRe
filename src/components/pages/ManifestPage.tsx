import { fetchApi } from "../../lib/fetchApi";
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { ReadinessProject } from "../../types";
import { Button } from "../ui/button";
import { getAccessToken, googleSignIn } from "../../lib/workspace-auth";
import { exportManifestToGoogleDoc } from "../../lib/workspace-api";
import { SectionMarker, SystemRail, SignalMark, CoordinateLabel } from "../ui/MatrixPrimitives";
import { FileText, Copy, Check, ShieldCheck, AlertOctagon, FileSpreadsheet, ExternalLink, RefreshCw, FileCode2 } from "lucide-react";
import { useStore } from "../../lib/store";
import { useAuth } from "../../contexts/AuthContext";

export function ManifestPage() {
  const { project, reloadProject } = useOutletContext<{
    project: ReadinessProject;
    reloadProject: () => void;
  }>();
  
  const [loading, setLoading] = useState(false);
  const [exportingDoc, setExportingDoc] = useState(false);
  const [exportedDocUrl, setExportedDocUrl] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);
  const { fetchWallet } = useStore();
  const { user } = useAuth();

  const generateManifest = async () => {
    setLoading(true);
    setExportError(null);
    try {
      // 3. Kjerne-algoritmer (Manifest): Web Crypto API for SHA-256
      const encoder = new TextEncoder();
      const serializedState = JSON.stringify({
        releaseId: project.id,
        title: project.title,
        artist: project.primaryArtist,
        revision: project.revision,
        assets: project.assets,
        credits: project.credits,
      });
      const data = encoder.encode(serializedState);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      const clientDigest = `sha256-${hashHex}`;

      const res = await fetchApi(`/api/projects/${project.id}/manifest`, { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientDigest, actorId: user?.id })
      });
      
      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to generate manifest");
      }
      
      reloadProject();
      if (user) fetchWallet(user.id);
    } catch (e: any) {
      console.error(e);
      setExportError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportToGoogleDoc = async () => {
    if (!project.manifest) return;
    setExportingDoc(true);
    setExportError(null);
    try {
      let token = await getAccessToken();
      if (!token) {
        const authRes = await googleSignIn();
        token = authRes?.accessToken || null;
      }

      if (!token) {
        throw new Error("Google Workspace authorization required to create docs.");
      }

      const { documentUrl } = await exportManifestToGoogleDoc(token, project, project.manifest);
      setExportedDocUrl(documentUrl);
    } catch (err: any) {
      console.error(err);
      setExportError(err.message || "Failed to export manifest to Google Doc.");
    } finally {
      setExportingDoc(false);
    }
  };

  const handleCopy = (text: string, format: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFormat(format);
    setTimeout(() => setCopiedFormat(null), 2000);
  };

  const isBlocked = project.findings.some((f) => f.severity === "blocked" && f.status === "unresolved");

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <SectionMarker idx="08" label="Cryptographic Delivery Manifest" />
          <h2 className="text-2xl font-bold font-display tracking-tight text-foreground mt-2">
            Immutable Delivery Snapshot
          </h2>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-wider mt-1">
            Deterministic SHA-256 digest &bull; DSP Package Export &bull; Google Docs Sign-Off
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {project.manifest && (
            <Button
              variant="quiet"
              onClick={handleExportToGoogleDoc}
              disabled={exportingDoc}
              className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider"
            >
              <FileText className="w-3.5 h-3.5 text-primary-glow" />
              {exportingDoc ? "Exporting Doc..." : "Export to Google Doc"}
            </Button>
          )}

          <Button
            onClick={generateManifest}
            disabled={loading || isBlocked}
            variant="hero"
            className="font-mono text-xs uppercase tracking-wider flex items-center gap-2"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Computing Digest...
              </>
            ) : project.manifest ? (
              "Regenerate Snapshot"
            ) : (
              "Seal Delivery Manifest"
            )}
          </Button>
        </div>
      </div>

      {/* Google Doc Export Success Banner */}
      {exportedDocUrl && (
        <div className="surface-panel p-5 border-brand-border bg-brand-soft/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4 font-mono text-xs">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-primary-glow animate-pulse" />
            <div>
              <span className="font-bold text-foreground uppercase tracking-wider">Manifest Exported to Google Docs</span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Formatted delivery manifest created with project specifications, checksums, and legal attestation.
              </p>
            </div>
          </div>
          <a
            href={exportedDocUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-primary hover:bg-brand-hover text-primary-foreground font-bold rounded-sm text-xs inline-flex items-center gap-1.5 transition-colors self-start sm:self-auto shrink-0 shadow-glow"
          >
            Open in Google Docs <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}

      {exportError && (
        <div className="p-4 bg-destructive/10 border border-destructive/40 rounded-sm font-mono text-xs text-destructive">
          {exportError}
        </div>
      )}

      {/* Blocker alert */}
      {isBlocked && !project.manifest && (
        <div className="surface-panel p-6 border-destructive/50 bg-destructive/5 font-mono text-xs space-y-2">
          <div className="flex items-center gap-2 text-destructive font-bold uppercase tracking-wider">
            <AlertOctagon className="w-4 h-4" />
            <span>Generation Blocked by Rule Engine</span>
          </div>
          <p className="text-muted-foreground">
            You cannot generate a cryptographic delivery manifest while unresolved blocking findings exist in Credits or Audio Assets.
          </p>
        </div>
      )}

      {/* Manifest Content */}
      {project.manifest ? (
        <div className="space-y-6">
          <SystemRail 
            idx="08.A" 
            label="Cryptographic Identity Ledger" 
            rightContent={<SignalMark status="confirmed" label="SHA-256 SEALED" tone="lime" />}
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="surface-panel p-4 space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Manifest Handle</span>
              <div className="font-mono text-xs font-bold text-foreground truncate">{project.manifest.id}</div>
            </div>
            <div className="surface-panel p-4 space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Generated Timestamp</span>
              <div className="font-mono text-xs text-foreground tabular-nums">
                {new Date(project.manifest.generatedAt).toUTCString()}
              </div>
            </div>
            <div className="surface-panel p-4 space-y-1">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Deterministic Digest</span>
              <div className="font-mono text-xs text-accent font-bold truncate" title={project.manifest.digest}>
                {project.manifest.digest}
              </div>
            </div>
          </div>

          {/* JSON Spec */}
          <div className="surface-panel p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-glow" />
                <h4 className="font-mono text-xs font-bold uppercase text-foreground">JSON Machine Manifest</h4>
                <span className="text-[10px] font-mono text-muted-foreground">(Downstream DSP Spec)</span>
              </div>
              <Button
                variant="quiet"
                onClick={() => handleCopy(project.manifest!.contentJson, "json")}
                className="font-mono text-xs uppercase tracking-wider flex items-center gap-1.5"
              >
                {copiedFormat === "json" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy JSON</span>
                  </>
                )}
              </Button>
            </div>
            <pre className="bg-background border border-border rounded-sm p-4 font-mono text-xs overflow-x-auto text-muted-foreground max-h-72 leading-relaxed">
              {project.manifest.contentJson}
            </pre>
          </div>

          {/* DDEX XML Spec */}
          {project.manifest.contentDdexXml && (
            <div className="surface-panel p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-primary-glow" />
                  <h4 className="font-mono text-xs font-bold uppercase text-foreground">DDEX ERN XML Format</h4>
                  <span className="text-[10px] font-mono text-muted-foreground">(Enterprise Distributor Standard)</span>
                </div>
                <Button
                  variant="quiet"
                  onClick={() => handleCopy(project.manifest!.contentDdexXml!, "xml")}
                  className="font-mono text-xs uppercase tracking-wider flex items-center gap-1.5"
                >
                  {copiedFormat === "xml" ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy XML</span>
                    </>
                  )}
                </Button>
              </div>
              <pre className="bg-background border border-border rounded-sm p-4 font-mono text-xs overflow-x-auto text-muted-foreground max-h-72 leading-relaxed">
                {project.manifest.contentDdexXml}
              </pre>
            </div>
          )}

          {/* CSV Spec */}
          <div className="surface-panel p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-accent" />
                <h4 className="font-mono text-xs font-bold uppercase text-foreground">CSV Distribution Roster</h4>
                <span className="text-[10px] font-mono text-muted-foreground">(Asset &amp; Credit Ledger)</span>
              </div>
              <Button
                variant="quiet"
                onClick={() => handleCopy(project.manifest!.contentCsv, "csv")}
                className="font-mono text-xs uppercase tracking-wider flex items-center gap-1.5"
              >
                {copiedFormat === "csv" ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy CSV</span>
                  </>
                )}
              </Button>
            </div>
            <pre className="bg-background border border-border rounded-sm p-4 font-mono text-xs overflow-x-auto text-muted-foreground max-h-48 leading-relaxed">
              {project.manifest.contentCsv}
            </pre>
          </div>
        </div>
      ) : (
        <div className="surface-panel p-12 text-center text-muted-foreground font-mono text-xs border-dashed space-y-3">
          <ShieldCheck className="w-8 h-8 mx-auto opacity-40 text-muted-foreground" />
          <p>No manifest has been sealed for this revision. Resolve all checks and click &quot;Seal Delivery Manifest&quot;.</p>
        </div>
      )}
    </div>
  );
}

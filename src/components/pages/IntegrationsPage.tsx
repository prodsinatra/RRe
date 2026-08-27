import { useState, useEffect } from "react";
import { User } from "firebase/auth";
import { initWorkspaceAuth, googleSignIn, workspaceLogout } from "../../lib/workspace-auth";
import { searchDriveFiles, fetchSpreadsheetData, exportManifestToGoogleDoc, DriveItem } from "../../lib/workspace-api";
import { Button } from "../ui/button";
import { SectionMarker, SystemRail, SignalMark, CoordinateLabel } from "../ui/MatrixPrimitives";
import { HardDrive, FileSpreadsheet, FileText, RefreshCw, Zap, ExternalLink, CheckCircle2 } from "lucide-react";

export function IntegrationsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [driveFiles, setDriveFiles] = useState<DriveItem[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "audio" | "image" | "sheet">("all");

  useEffect(() => {
    const unsubscribe = initWorkspaceAuth(
      (u, t) => {
        setUser(u);
        setToken(t);
      },
      () => {
        setUser(null);
        setToken(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
      }
    } catch (err) {
      console.error("Login failed:", err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await workspaceLogout();
    setUser(null);
    setToken(null);
    setDriveFiles([]);
  };

  const loadDriveFiles = async (type = filterType) => {
    if (!token) return;
    setLoadingFiles(true);
    try {
      const files = await searchDriveFiles(token, {
        filterType: type,
        pageSize: 10,
      });
      setDriveFiles(files);
    } catch (err) {
      console.error("Failed to load drive files:", err);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadDriveFiles(filterType);
    }
  }, [token, filterType]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <SectionMarker idx="10" label="External Workspace & Ingestion Bridge" />
          <h2 className="text-2xl font-bold font-display tracking-tight text-foreground mt-2">
            Workspace Ingestion Matrix
          </h2>
          <p className="text-muted-foreground font-mono text-xs uppercase tracking-wider mt-1">
            Direct OAuth bridge to Google Drive (Stems/Art), Google Sheets (Splits), and Google Docs (Manifests).
          </p>
        </div>

        <div className="flex items-center gap-4">
          <SignalMark 
            status={user ? "confirmed" : "pending"} 
            label={user ? "WORKSPACE BRIDGE CONNECTED" : "UNAUTHORIZED"} 
            tone={user ? "lime" : "amber"} 
          />
          <CoordinateLabel text="SERVICES // OAUTH2" />
        </div>
      </div>

      <div className="surface-panel p-6 sm:p-8 space-y-8">
        {!user ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-6 text-center">
            <div className="w-14 h-14 rounded-sm bg-surface-raised border border-brand-border flex items-center justify-center font-mono text-primary-glow shadow-glow">
              <Zap className="w-6 h-6" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="font-display text-xl font-bold text-foreground">Authorize Google Workspace</h3>
              <p className="text-xs font-mono text-muted-foreground leading-relaxed">
                Connect your account to enable direct asset ingestion from Google Drive, automatic splits extraction from Google Sheets, and manifest sign-offs via Google Docs.
              </p>
            </div>

            <Button
              onClick={handleLogin}
              disabled={isLoggingIn}
              variant="hero"
              className="font-mono text-xs uppercase tracking-wider flex items-center gap-2 px-6 py-2.5"
            >
              {isLoggingIn ? "Authorizing..." : "Authorize Google Workspace"}
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {/* User Session Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
              <div className="flex items-center gap-4">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt="Profile"
                    className="w-11 h-11 rounded-sm object-cover border border-border-strong"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-11 h-11 rounded-sm bg-surface-raised border border-brand-border flex items-center justify-center font-mono text-xs text-primary-glow font-bold">
                    OP
                  </div>
                )}
                <div>
                  <div className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                    <span>{user.displayName || "Workspace Operator"}</span>
                    <span className="px-2 py-0.5 rounded-sm bg-accent-soft border border-accent-border text-accent font-mono text-[10px] uppercase font-bold">
                      CONNECTED
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{user.email}</div>
                </div>
              </div>
              <Button 
                variant="quiet" 
                onClick={handleLogout} 
                className="font-mono text-xs uppercase tracking-wider self-start sm:self-auto"
              >
                Disconnect Workspace
              </Button>
            </div>

            {/* Integration Services Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
              {/* 1. Google Drive */}
              <div className="surface-panel p-5 space-y-3 flex flex-col justify-between border-brand-border/40">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-primary-glow" />
                      <h4 className="font-bold text-foreground uppercase">Google Drive</h4>
                    </div>
                    <span className="text-[10px] text-accent bg-accent-soft border border-accent-border px-2 py-0.5 rounded-sm uppercase font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Ingest 24-bit .wav master audio stems and 3000&times;3000px artwork records directly into active release sessions.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 pt-3 border-t border-border">
                  {(["all", "audio", "image", "sheet"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={`px-2 py-1 rounded-sm text-[10px] uppercase font-mono transition-colors ${
                        filterType === t
                          ? "bg-primary text-primary-foreground font-bold"
                          : "bg-surface text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Google Sheets */}
              <div className="surface-panel p-5 space-y-3 flex flex-col justify-between border-emerald-500/30">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <h4 className="font-bold text-foreground uppercase">Google Sheets</h4>
                    </div>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-sm uppercase font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Automated schema parser mapping spreadsheet rows into contributor roles and 100.00% split matrices.
                  </p>
                </div>
                <div className="pt-3 border-t border-border text-[10px] text-muted-foreground">
                  Available in <span className="text-foreground font-bold">Credits &amp; Splits</span> view.
                </div>
              </div>

              {/* 3. Google Docs */}
              <div className="surface-panel p-5 space-y-3 flex flex-col justify-between border-blue-500/30">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <h4 className="font-bold text-foreground uppercase">Google Docs</h4>
                    </div>
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-sm uppercase font-bold">
                      ACTIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    Export deterministic delivery manifests to formatted Google Docs for legal sign-off and distributor handoff.
                  </p>
                </div>
                <div className="pt-3 border-t border-border text-[10px] text-muted-foreground">
                  Available in <span className="text-foreground font-bold">Delivery Manifest</span> view.
                </div>
              </div>
            </div>

            {/* Live Drive File Feed */}
            <div className="space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground uppercase">Connected Drive Files ({filterType.toUpperCase()})</span>
                  <span className="text-[10px] text-muted-foreground">Recent 10 Files</span>
                </div>
                <Button
                  variant="quiet"
                  onClick={() => loadDriveFiles(filterType)}
                  disabled={loadingFiles}
                  className="font-mono text-xs uppercase tracking-wider flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingFiles ? "animate-spin" : ""}`} />
                  Refresh Feed
                </Button>
              </div>

              {loadingFiles ? (
                <div className="py-8 text-center text-muted-foreground">Reading Google Drive records...</div>
              ) : driveFiles.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {driveFiles.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between p-3 surface-panel hover:border-brand-border transition-colors"
                    >
                      <div className="min-w-0 pr-4">
                        <p className="text-xs font-semibold text-foreground truncate">{f.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">{f.mimeType}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0 font-mono tabular-nums">
                        {f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString() : "Recent"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-muted-foreground border border-dashed border-border rounded-sm">
                  No files matching filter found in your Google Drive.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from "react";
import { getAccessToken, googleSignIn } from "../../lib/workspace-auth";
import { searchDriveFiles, DriveItem } from "../../lib/workspace-api";
import { Button } from "./button";

interface DrivePickerProps {
  onSelect: (file: DriveItem) => void;
  onCancel: () => void;
  filterType?: "all" | "audio" | "image" | "sheet";
  title?: string;
}

export function DrivePicker({
  onSelect,
  onCancel,
  filterType = "all",
  title = "Select Asset from Google Drive",
}: DrivePickerProps) {
  const [files, setFiles] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<DriveItem | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const fetchFiles = async (query = "") => {
    setLoading(true);
    setError(null);
    try {
      let token = await getAccessToken();
      if (!token) {
        setFiles([]);
        setLoading(false);
        return;
      }

      const results = await searchDriveFiles(token, {
        query,
        filterType,
        pageSize: 35,
      });
      setFiles(results);
    } catch (err: any) {
      console.error("Drive fetch error:", err);
      setError(err.message || "Failed to load files from Google Drive.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(searchQuery);
  }, [filterType]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchFiles(searchQuery);
  };

  const handleConnect = async () => {
    setIsAuthenticating(true);
    try {
      const res = await googleSignIn();
      if (res?.accessToken) {
        await fetchFiles(searchQuery);
      }
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setIsAuthenticating(false);
    }
  };

  const formatFileSize = (bytesStr?: string) => {
    if (!bytesStr) return "Unknown size";
    const bytes = parseInt(bytesStr, 10);
    if (isNaN(bytes)) return "Unknown";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#111111] border border-[#262626] w-full max-w-2xl rounded-xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden text-[#E0E0E0]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#262626] bg-[#161616]">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-lime-400"></div>
            <div>
              <h3 className="font-mono text-sm font-bold text-white uppercase tracking-wider">{title}</h3>
              <p className="text-[11px] text-[#888888] font-mono">Filter: {filterType.toUpperCase()} &bull; Google Drive Ingestion</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="w-8 h-8 rounded border border-[#333] hover:bg-[#262626] flex items-center justify-center text-muted-foreground hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="p-4 border-b border-[#262626] bg-[#0F0F0F] flex gap-2">
          <input
            type="text"
            className="flex-1 bg-[#181818] border border-[#333] rounded px-3 py-2 text-xs font-mono text-white placeholder-[#666] focus:outline-none focus:border-lime-400"
            placeholder={`Search ${filterType} files in Drive (e.g. 'Master', 'Mix', 'Art')...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Button type="submit" variant="outline" size="sm" className="font-mono text-xs">
            Search
          </Button>
        </form>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[300px]">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 space-y-3">
              <div className="w-6 h-6 border-2 border-lime-400 border-t-transparent rounded-full animate-spin"></div>
              <div className="text-xs font-mono text-[#888] uppercase tracking-widest">Querying Google Drive...</div>
            </div>
          ) : error ? (
            <div className="text-center py-12 px-6">
              <div className="text-red-400 font-mono text-xs mb-3">{error}</div>
              <Button onClick={handleConnect} disabled={isAuthenticating} variant="hero" size="sm">
                {isAuthenticating ? "Connecting..." : "Authenticate with Google"}
              </Button>
            </div>
          ) : files.length === 0 ? (
            <div className="text-center py-12 px-6 border border-dashed border-[#333] rounded-lg">
              <p className="text-xs text-[#888] font-mono mb-3">No matching files found in your connected Google Drive.</p>
              <Button onClick={() => fetchFiles("")} variant="outline" size="sm">
                Refresh All Files
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {files.map((file) => {
                const isSelected = selectedFile?.id === file.id;
                return (
                  <div
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    className={`flex items-center justify-between p-3 rounded border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-[#1f2915] border-lime-400/80 text-white"
                        : "bg-[#161616] border-[#262626] hover:border-[#444] hover:bg-[#1a1a1a] text-[#CCC]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
                      {file.thumbnailLink ? (
                        <img
                          src={file.thumbnailLink}
                          alt=""
                          className="w-9 h-9 rounded object-cover border border-[#333] shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded bg-[#222] border border-[#333] flex items-center justify-center font-mono text-[10px] text-[#888] shrink-0 uppercase">
                          {filterType === "audio" ? "WAV" : filterType === "image" ? "IMG" : "DOC"}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-mono font-medium truncate text-white">{file.name}</p>
                        <div className="flex items-center gap-2 text-[10px] text-[#888] font-mono mt-0.5">
                          <span>{formatFileSize(file.size)}</span>
                          <span>&bull;</span>
                          <span className="truncate max-w-[200px]">{file.mimeType}</span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      {isSelected && (
                        <span className="text-[10px] font-mono text-lime-400 uppercase font-bold tracking-widest px-2 py-0.5 bg-lime-400/10 border border-lime-400/30 rounded">
                          Selected
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#262626] bg-[#161616] flex items-center justify-between">
          <span className="text-[11px] font-mono text-[#888]">
            {selectedFile ? `Ready to import: ${selectedFile.name}` : "Choose a file to ingest"}
          </span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button
              variant="hero"
              size="sm"
              disabled={!selectedFile}
              onClick={() => selectedFile && onSelect(selectedFile)}
            >
              Ingest Selected Asset
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

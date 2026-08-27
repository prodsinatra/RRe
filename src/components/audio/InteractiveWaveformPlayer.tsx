import { useState, useRef, useEffect, useCallback } from "react";
import { ReleaseAsset, AudioDiagnostics } from "../../types";
import { getAudioContext, analyzeAudioBuffer, audioBufferToWavDataUrl } from "../../lib/audio-diagnostics";
import { Button } from "../ui/button";

interface InteractiveWaveformPlayerProps {
  asset: ReleaseAsset;
  onDiagnosticsUpdated?: (updatedAsset: ReleaseAsset) => void;
}

export function InteractiveWaveformPlayer({
  asset,
  onDiagnosticsUpdated
}: InteractiveWaveformPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(asset.diagnostics?.durationSeconds || 8);
  const [isLooping, setIsLooping] = useState(false);
  const [activeTab, setActiveTab] = useState<"waveform" | "spectrum" | "phase">("waveform");
  const [isScanning, setIsScanning] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const phaseCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const diagnostics = asset.diagnostics;

  // Initialize or connect Web Audio Analyser
  const setupWebAudio = useCallback(() => {
    if (!audioRef.current) return;
    if (!audioContextRef.current) {
      const ctx = getAudioContext();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;
      analyserRef.current = analyser;

      try {
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination);
        sourceNodeRef.current = source;
      } catch (e) {
        // Source might already be connected
      }
    }
  }, []);

  // Handle Play/Pause
  const togglePlay = async () => {
    if (!audioRef.current) return;
    setupWebAudio();

    if (audioContextRef.current?.state === "suspended") {
      await audioContextRef.current.resume();
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.warn("[Playback Error]:", err);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !audioRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const pct = Math.max(0, Math.min(1, clickX / rect.width));
    const targetTime = pct * duration;
    audioRef.current.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  // Draw Waveform Canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High DPI Canvas sizing
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Background: Deep graphite grid
    ctx.fillStyle = "#0c0c0e";
    ctx.fillRect(0, 0, width, height);

    // Grid lines (dB lines & timeline markers)
    ctx.strokeStyle = "#1e1e24";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);

    // Center zero-line
    const centerY = height / 2;
    ctx.beginPath();
    ctx.moveTo(0, centerY);
    ctx.lineTo(width, centerY);
    ctx.stroke();

    // 0 dBFS Peak Ceiling Guideline (Red warning line)
    ctx.strokeStyle = "rgba(239, 68, 68, 0.4)";
    ctx.beginPath();
    ctx.moveTo(0, 4);
    ctx.lineTo(width, 4);
    ctx.moveTo(0, height - 4);
    ctx.lineTo(width, height - 4);
    ctx.stroke();

    // -0.5 dBFS Ceiling Guideline (Lime guideline)
    ctx.strokeStyle = "rgba(163, 230, 53, 0.25)";
    ctx.beginPath();
    ctx.moveTo(0, height * 0.1);
    ctx.lineTo(width, height * 0.1);
    ctx.moveTo(0, height * 0.9);
    ctx.lineTo(width, height * 0.9);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw waveform bars / peaks
    const peaks = diagnostics?.waveformPeaks || [];
    const numBars = peaks.length > 0 ? peaks.length : 120;
    const barWidth = Math.max(2, (width / numBars) - 1.5);
    const progressPct = duration > 0 ? currentTime / duration : 0;

    for (let i = 0; i < numBars; i++) {
      const x = i * (width / numBars);
      const isPast = x / width <= progressPct;

      // Peak value between 0.05 and 0.95
      let val = peaks[i] !== undefined ? peaks[i] : 0.2 + 0.6 * Math.sin(i * 0.15) * Math.sin(i * 0.05);
      val = Math.max(0.06, Math.min(1.0, val));
      const barHeight = val * (height * 0.85);

      // Check if this point has clipping
      const barTimeSec = (i / numBars) * duration;
      const isClipped = diagnostics?.clippingTimestamps?.some(
        (t) => Math.abs(t - barTimeSec) < duration / numBars
      );

      // Color selection
      if (isClipped) {
        ctx.fillStyle = "#ef4444"; // Red for clipped sample
      } else if (isPast) {
        ctx.fillStyle = "#a3e635"; // Neon acid lime for played portion
      } else {
        ctx.fillStyle = "#3f3f46"; // Graphite zinc for upcoming portion
      }

      // Render symmetric waveform around center
      const yTop = centerY - barHeight / 2;
      ctx.fillRect(x, yTop, barWidth, barHeight);

      // Render clipping flag marker indicator
      if (isClipped) {
        ctx.fillStyle = "#ef4444";
        ctx.beginPath();
        ctx.arc(x + barWidth / 2, 6, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Playhead line
    const playheadX = progressPct * width;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#a3e635";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(playheadX, 0);
    ctx.lineTo(playheadX, height);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }, [diagnostics, currentTime, duration]);

  // Real-Time Frequency Spectrum / Phase Animation loop
  useEffect(() => {
    let active = true;

    const renderRealtimeVisuals = () => {
      if (!active) return;

      const analyser = analyserRef.current;
      if (analyser && isPlaying) {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        // 1. Spectrum Canvas
        if (spectrumCanvasRef.current && activeTab === "spectrum") {
          analyser.getByteFrequencyData(dataArray);
          const canvas = spectrumCanvasRef.current;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const w = canvas.width;
            const h = canvas.height;
            ctx.fillStyle = "#0c0c0e";
            ctx.fillRect(0, 0, w, h);

            // Draw Frequency Bars
            const numSpectrumBars = 64;
            const barW = (w / numSpectrumBars) - 1;
            for (let i = 0; i < numSpectrumBars; i++) {
              const binIndex = Math.floor((i / numSpectrumBars) * (bufferLength / 2));
              const val = dataArray[binIndex] / 255;
              const barH = val * h;

              // Frequency color grading (Acid lime -> Cyan -> Orange)
              const grad = ctx.createLinearGradient(0, h, 0, 0);
              grad.addColorStop(0, "#4d7c0f");
              grad.addColorStop(0.6, "#a3e635");
              grad.addColorStop(1.0, "#facc15");

              ctx.fillStyle = grad;
              ctx.fillRect(i * (w / numSpectrumBars), h - barH, barW, barH);
            }
          }
        }

        // 2. Phase / Vectorscope Canvas
        if (phaseCanvasRef.current && activeTab === "phase") {
          analyser.getByteTimeDomainData(dataArray);
          const canvas = phaseCanvasRef.current;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const w = canvas.width;
            const h = canvas.height;
            ctx.fillStyle = "rgba(12, 12, 14, 0.25)";
            ctx.fillRect(0, 0, w, h);

            ctx.strokeStyle = "#a3e635";
            ctx.lineWidth = 1.5;
            ctx.beginPath();

            const sliceWidth = w / bufferLength;
            let x = 0;
            for (let i = 0; i < bufferLength; i++) {
              const v = dataArray[i] / 128.0;
              const y = (v * h) / 2;
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
              x += sliceWidth;
            }
            ctx.stroke();
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(renderRealtimeVisuals);
    };

    renderRealtimeVisuals();

    return () => {
      active = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, activeTab]);

  // Run full signal verification scan on this asset
  const handleTriggerSignalScan = async () => {
    setIsScanning(true);
    try {
      let audioBuffer: AudioBuffer;

      // If asset has direct audioUrl or synthetic source, generate/fetch and analyze
      if (asset.audioUrl) {
        const response = await fetch(asset.audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const ctx = getAudioContext();
        audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      } else {
        // Generate high-fidelity test signal for simulation
        const { generateSyntheticAudioTrack } = await import("../../lib/audio-diagnostics");
        audioBuffer = generateSyntheticAudioTrack(8, asset.sampleRateHz || 48000, {
          loudnessTarget: asset.assetType === "clean" ? "streaming" : "club",
          induceClipping: asset.filename.includes("MASTER_v2") && asset.assetType === "clean" // induce clipping flag on clean duplicate test
        });
      }

      const analyzedDiagnostics = analyzeAudioBuffer(audioBuffer);
      const audioUrl = asset.audioUrl || audioBufferToWavDataUrl(audioBuffer);

      const updatedAsset: ReleaseAsset = {
        ...asset,
        diagnostics: analyzedDiagnostics,
        durationMs: Math.round(analyzedDiagnostics.durationSeconds * 1000),
        sampleRateHz: analyzedDiagnostics.sampleRate,
        channels: analyzedDiagnostics.channels,
        bitDepth: analyzedDiagnostics.bitDepth,
        audioUrl
      };

      setDuration(analyzedDiagnostics.durationSeconds);
      if (onDiagnosticsUpdated) {
        onDiagnosticsUpdated(updatedAsset);
      }
    } catch (err) {
      console.error("[Signal Scan Error]:", err);
    } finally {
      setIsScanning(false);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    const ms = Math.floor((secs % 1) * 10);
    return `${mins}:${remainingSecs.toString().padStart(2, "0")}.${ms}`;
  };

  return (
    <div className="bg-[#111114] border border-[#27272a] rounded-xl p-5 space-y-4 shadow-2xl">
      {/* Audio Element */}
      <audio
        ref={audioRef}
        src={asset.audioUrl}
        loop={isLooping}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        crossOrigin="anonymous"
      />

      {/* Header bar: Asset Info & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272a] pb-3">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            disabled={!asset.audioUrl && !diagnostics}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              isPlaying
                ? "bg-lime-400 text-black shadow-[0_0_15px_rgba(163,230,53,0.5)]"
                : "bg-[#27272a] text-white hover:bg-lime-400 hover:text-black hover:shadow-[0_0_10px_rgba(163,230,53,0.3)]"
            }`}
            title={isPlaying ? "Pause" : "Play Master Preview"}
          >
            {isPlaying ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg className="w-4 h-4 translate-x-0.5" fill="currentColor" viewBox="0 0 24 24">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-xs text-white uppercase tracking-wider">
                {asset.filename}
              </span>
              <span className="bg-[#1f1f23] text-lime-400 text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-[#333]">
                {asset.assetType}
              </span>
              {diagnostics?.verdict && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase font-bold ${
                    diagnostics.verdict === "passed"
                      ? "bg-lime-950/60 border-lime-500/50 text-lime-400"
                      : diagnostics.verdict === "warning"
                      ? "bg-amber-950/60 border-amber-500/50 text-amber-400"
                      : "bg-red-950/60 border-red-500/50 text-red-400"
                  }`}
                >
                  {diagnostics.verdict === "passed" ? "Signal Valid" : diagnostics.verdict}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-zinc-400 mt-0.5">
              <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
              <span>&bull;</span>
              <span>{asset.sampleRateHz ? `${asset.sampleRateHz / 1000} kHz` : "48 kHz"}</span>
              <span>&bull;</span>
              <span>{asset.bitDepth || 24} bit PCM</span>
            </div>
          </div>
        </div>

        {/* Action buttons & View toggles */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-[#18181b] border border-[#27272a] rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab("waveform")}
              className={`px-2.5 py-1 text-[10px] font-mono uppercase rounded transition-colors ${
                activeTab === "waveform"
                  ? "bg-lime-400 text-black font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Waveform
            </button>
            <button
              onClick={() => setActiveTab("spectrum")}
              className={`px-2.5 py-1 text-[10px] font-mono uppercase rounded transition-colors ${
                activeTab === "spectrum"
                  ? "bg-lime-400 text-black font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              RTA FFT
            </button>
            <button
              onClick={() => setActiveTab("phase")}
              className={`px-2.5 py-1 text-[10px] font-mono uppercase rounded transition-colors ${
                activeTab === "phase"
                  ? "bg-lime-400 text-black font-bold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Phase
            </button>
          </div>

          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`p-1.5 rounded-lg border text-xs font-mono transition-colors ${
              isLooping
                ? "bg-lime-950/50 border-lime-500/50 text-lime-400"
                : "bg-[#18181b] border-[#27272a] text-zinc-400 hover:text-white"
            }`}
            title="Toggle Loop"
          >
            ↻
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerSignalScan}
            disabled={isScanning}
            className="text-[11px] font-mono border-lime-500/40 text-lime-400 hover:bg-lime-400/10"
          >
            {isScanning ? "Analyzing..." : diagnostics ? "Re-Scan Signal" : "Run Signal Scan"}
          </Button>
        </div>
      </div>

      {/* Main Visualizer Area */}
      <div className="relative bg-[#0c0c0e] border border-[#27272a] rounded-lg overflow-hidden h-28 cursor-pointer group">
        {activeTab === "waveform" && (
          <canvas
            ref={canvasRef}
            onClick={handleSeek}
            className="w-full h-full block"
          />
        )}
        {activeTab === "spectrum" && (
          <canvas
            ref={spectrumCanvasRef}
            width={600}
            height={112}
            className="w-full h-full block"
          />
        )}
        {activeTab === "phase" && (
          <canvas
            ref={phaseCanvasRef}
            width={600}
            height={112}
            className="w-full h-full block"
          />
        )}

        {/* Overlay guides */}
        <div className="absolute top-1.5 right-2 text-[9px] font-mono text-zinc-500 pointer-events-none flex items-center gap-2">
          <span className="text-red-400/70">0.0 dBFS Peak Ceiling</span>
          <span>&bull;</span>
          <span className="text-lime-400/70">-0.5 dBFS Stream Ceiling</span>
        </div>
      </div>

      {/* Real-Time Telemetry & Diagnostic Signal Meters */}
      {diagnostics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1">
          {/* 1. True Peak dBFS */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-2.5 font-mono">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>True Peak</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  diagnostics.truePeakDbfs > 0
                    ? "bg-red-500 animate-pulse shadow-[0_0_8px_#ef4444]"
                    : diagnostics.truePeakDbfs > -0.5
                    ? "bg-amber-400"
                    : "bg-lime-400"
                }`}
              />
            </div>
            <div
              className={`text-base font-bold mt-1 ${
                diagnostics.truePeakDbfs > 0
                  ? "text-red-400"
                  : diagnostics.truePeakDbfs > -0.5
                  ? "text-amber-300"
                  : "text-lime-400"
              }`}
            >
              {diagnostics.truePeakDbfs > 0 ? `+${diagnostics.truePeakDbfs}` : diagnostics.truePeakDbfs} dBFS
            </div>
            <div className="text-[9px] text-zinc-500 mt-0.5">Target: &le; -0.5 dBFS</div>
          </div>

          {/* 2. Integrated LUFS */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-2.5 font-mono">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Loudness (LUFS)</div>
            <div className="text-base font-bold text-white mt-1">
              {diagnostics.integratedLufs} LUFS
            </div>
            <div className="text-[9px] text-zinc-500 mt-0.5">Club: -8 / Stream: -14</div>
          </div>

          {/* 3. Dynamic Range (PLR / Crest Factor) */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-2.5 font-mono">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Dynamic Range</div>
            <div className="text-base font-bold text-lime-300 mt-1">
              {diagnostics.dynamicRangeDb} dB
            </div>
            <div className="text-[9px] text-zinc-500 mt-0.5">Punchiness Index</div>
          </div>

          {/* 4. Clipping Count */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-2.5 font-mono">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider flex items-center justify-between">
              <span>Clipping</span>
              {diagnostics.clippingCount > 0 && (
                <span className="text-[9px] bg-red-950 text-red-400 px-1 py-0.2 rounded border border-red-500/40">
                  FAIL
                </span>
              )}
            </div>
            <div
              className={`text-base font-bold mt-1 ${
                diagnostics.clippingCount > 0 ? "text-red-400 font-black" : "text-lime-400"
              }`}
            >
              {diagnostics.clippingCount} Samples
            </div>
            <div className="text-[9px] text-zinc-500 mt-0.5">Zero tolerance</div>
          </div>

          {/* 5. Phase Correlation */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-2.5 font-mono">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Stereo Phase</div>
            <div
              className={`text-base font-bold mt-1 ${
                diagnostics.phaseCorrelation >= 0.5
                  ? "text-lime-400"
                  : diagnostics.phaseCorrelation >= 0.1
                  ? "text-amber-400"
                  : "text-red-400"
              }`}
            >
              {diagnostics.phaseCorrelation > 0 ? `+${diagnostics.phaseCorrelation}` : diagnostics.phaseCorrelation}
            </div>
            <div className="text-[9px] text-zinc-500 mt-0.5">+1.0 = Mono Safe</div>
          </div>

          {/* 6. DC Offset */}
          <div className="bg-[#18181b] border border-[#27272a] rounded-lg p-2.5 font-mono">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">DC Offset</div>
            <div className="text-base font-bold text-white mt-1">
              {diagnostics.dcOffsetPercent}%
            </div>
            <div className="text-[9px] text-zinc-500 mt-0.5">Tolerance &lt; 0.1%</div>
          </div>
        </div>
      )}

      {/* Spectral Energy Distribution Bars */}
      {diagnostics && diagnostics.spectralBands && (
        <div className="bg-[#141417] border border-[#27272a] rounded-lg p-3 space-y-2">
          <div className="text-[11px] font-mono uppercase text-zinc-400 flex items-center justify-between">
            <span>Spectral Energy Distribution (808 Sub vs Highs)</span>
            <span className="text-[10px] text-lime-400 font-mono">
              Sub-Weight: {Math.round(diagnostics.spectralBands.subBass * 100)}%
            </span>
          </div>

          <div className="grid grid-cols-4 gap-2 font-mono text-[10px]">
            {/* Sub-Bass */}
            <div className="space-y-1">
              <div className="flex justify-between text-zinc-400">
                <span>Sub (20-60Hz)</span>
                <span className="text-lime-400">{Math.round(diagnostics.spectralBands.subBass * 100)}%</span>
              </div>
              <div className="w-full bg-[#27272a] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-lime-400 h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(163,230,53,0.5)]"
                  style={{ width: `${Math.min(100, diagnostics.spectralBands.subBass * 200)}%` }}
                />
              </div>
            </div>

            {/* Bass / Low Mid */}
            <div className="space-y-1">
              <div className="flex justify-between text-zinc-400">
                <span>Bass (60-250Hz)</span>
                <span className="text-lime-300">{Math.round(diagnostics.spectralBands.bass * 100)}%</span>
              </div>
              <div className="w-full bg-[#27272a] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-lime-300 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, diagnostics.spectralBands.bass * 200)}%` }}
                />
              </div>
            </div>

            {/* Mids */}
            <div className="space-y-1">
              <div className="flex justify-between text-zinc-400">
                <span>Mids (250-4k)</span>
                <span className="text-zinc-300">{Math.round(diagnostics.spectralBands.mid * 100)}%</span>
              </div>
              <div className="w-full bg-[#27272a] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-zinc-400 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, diagnostics.spectralBands.mid * 200)}%` }}
                />
              </div>
            </div>

            {/* Highs / Air */}
            <div className="space-y-1">
              <div className="flex justify-between text-zinc-400">
                <span>Highs (4k-20k)</span>
                <span className="text-zinc-300">{Math.round(diagnostics.spectralBands.high * 100)}%</span>
              </div>
              <div className="w-full bg-[#27272a] h-2 rounded-full overflow-hidden">
                <div
                  className="bg-zinc-300 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, diagnostics.spectralBands.high * 200)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Signal Issues Warning List */}
      {diagnostics && diagnostics.issues.length > 0 && (
        <div className="p-3 bg-red-950/20 border border-red-500/30 rounded-lg space-y-1 font-mono text-xs text-red-300">
          <div className="font-bold flex items-center gap-1.5 uppercase text-[10px] text-red-400 tracking-wider">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
            Signal Anomalies Detected ({diagnostics.issues.length})
          </div>
          <ul className="list-disc list-inside space-y-0.5 text-[11px] text-zinc-300 pl-1">
            {diagnostics.issues.map((issue, idx) => (
              <li key={idx}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

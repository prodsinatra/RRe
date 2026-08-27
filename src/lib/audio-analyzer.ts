export interface AudioDiagnostics {
  truePeakDb: number;
  rmsDb: number;
  isClipped: boolean;
  clippingCount: number;
  sampleRate: number;
  durationSeconds: number;
}

export async function analyzeAudioBuffer(file: File): Promise<AudioDiagnostics> {
  // Using Web Audio API to decode and analyze the audio file
  const arrayBuffer = await file.arrayBuffer();
  
  // We use OfflineAudioContext to decode without playing
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContext();
  
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  
  let maxAbsValue = 0;
  let sumOfSquares = 0;
  let totalSamples = 0;
  let clippingCount = 0;
  
  // Analyze all channels
  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
    const channelData = audioBuffer.getChannelData(channel);
    for (let i = 0; i < channelData.length; i++) {
      const sample = channelData[i];
      const abs = Math.abs(sample);
      
      if (abs > maxAbsValue) maxAbsValue = abs;
      if (abs >= 1.0) clippingCount++;
      
      sumOfSquares += sample * sample;
      totalSamples++;
    }
  }
  
  // Calculate Peak in decibels
  // Standard equation: 20 * log10(amplitude)
  const peakDb = maxAbsValue > 0 ? 20 * Math.log10(maxAbsValue) : -Infinity;
  
  // Calculate RMS in decibels
  const rms = Math.sqrt(sumOfSquares / totalSamples);
  const rmsDb = rms > 0 ? 20 * Math.log10(rms) : -Infinity;
  
  // Close the audio context
  if (audioCtx.state !== 'closed') {
    audioCtx.close();
  }
  
  return {
    truePeakDb: peakDb,
    rmsDb: rmsDb,
    isClipped: maxAbsValue >= 1.0,
    clippingCount: clippingCount,
    sampleRate: audioBuffer.sampleRate,
    durationSeconds: audioBuffer.duration
  };
}

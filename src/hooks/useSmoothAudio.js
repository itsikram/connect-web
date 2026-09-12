import { useEffect, useRef } from "react";

/**
 * Applies a conservative cleanup chain to browser media:
 * removes sub-bass rumble, softens harsh hiss, and limits sudden peaks.
 * If a browser or cross-origin source rejects Web Audio, native playback is
 * left untouched instead of breaking the player.
 */
const useSmoothAudio = (mediaElement) => {
  const graphRef = useRef(null);

  useEffect(() => {
    if (!mediaElement || typeof window === "undefined") return undefined;

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return undefined;

    let graph;
    try {
      const context = new AudioContextClass();
      const source = context.createMediaElementSource(mediaElement);
      const highpass = context.createBiquadFilter();
      const lowpass = context.createBiquadFilter();
      const compressor = context.createDynamicsCompressor();
      const output = context.createGain();

      highpass.type = "highpass";
      highpass.frequency.value = 45;
      highpass.Q.value = 0.7;
      lowpass.type = "lowpass";
      lowpass.frequency.value = 15500;
      lowpass.Q.value = 0.7;

      compressor.threshold.value = -18;
      compressor.knee.value = 24;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.25;
      output.gain.value = 0.92;

      source
        .connect(highpass)
        .connect(lowpass)
        .connect(compressor)
        .connect(output)
        .connect(context.destination);

      const resume = () => {
        if (context.state === "suspended") context.resume().catch(() => {});
      };
      mediaElement.addEventListener("play", resume);
      graph = { context, source, highpass, lowpass, compressor, output, resume };
      graphRef.current = graph;
      resume();
    } catch (_) {
      // Cross-origin media and already-connected elements cannot be processed.
      return undefined;
    }

    return () => {
      mediaElement.removeEventListener("play", graph.resume);
      graph.source.disconnect();
      graph.highpass.disconnect();
      graph.lowpass.disconnect();
      graph.compressor.disconnect();
      graph.output.disconnect();
      graph.context.close().catch(() => {});
      if (graphRef.current === graph) graphRef.current = null;
    };
  }, [mediaElement]);
};

export default useSmoothAudio;

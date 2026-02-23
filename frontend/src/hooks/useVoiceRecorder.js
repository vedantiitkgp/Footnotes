import { useState, useRef, useEffect, useCallback } from 'react';

/**
 * useVoiceRecorder — MediaRecorder with live waveform via AnalyserNode.
 *
 * Returns:
 *   { isRecording, waveform: Float32Array, start, stop, audioBlob }
 */
export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [waveform, setWaveform]       = useState(new Float32Array(64));
  const [audioBlob, setAudioBlob]     = useState(null);

  const recorderRef = useRef(null);
  const analyserRef = useRef(null);
  const streamRef   = useRef(null);
  const rafRef      = useRef(null);
  const chunksRef   = useRef([]);

  // Waveform animation loop
  function tick() {
    if (!analyserRef.current) return;
    const data = new Float32Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getFloatTimeDomainData(data);
    setWaveform(data);
    rafRef.current = requestAnimationFrame(tick);
  }

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // Set up analyser
      const ctx      = new AudioContext();
      const source   = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyserRef.current = analyser;

      // MediaRecorder
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
        ctx.close();
        cancelAnimationFrame(rafRef.current);
        setWaveform(new Float32Array(64));
      };
      rec.start(100);
      recorderRef.current = rec;

      setIsRecording(true);
      tick();
    } catch (err) {
      console.warn('[VoiceRecorder] Cannot access microphone:', err.message);
    }
  }, []);

  const stop = useCallback(() => {
    recorderRef.current?.stop();
    setIsRecording(false);
  }, []);

  useEffect(() => () => {
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(rafRef.current);
  }, []);

  return { isRecording, waveform, start, stop, audioBlob };
}

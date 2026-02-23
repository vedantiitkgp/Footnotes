import { useEffect, useRef, useMemo } from 'react';

// ── Vibe detection ────────────────────────────────────────────────────────────
function detectVibe(locations) {
  if (!locations?.length) return 'default';
  const text = locations.join(' ').toLowerCase();
  if (/beach|ocean|sea|coast|island|bali|hawaii|caribbean|mediterranean|amalfi|santorini|maldives|fiji/.test(text))
    return 'coastal';
  if (/mountain|alps|himalaya|nepal|tibet|andes|colorado|rockies|everest|summit|peak/.test(text))
    return 'mountain';
  if (/jungle|forest|amazon|rainforest|thailand|cambodia|vietnam|borneo/.test(text))
    return 'jungle';
  if (/desert|sahara|morocco|dubai|egypt|arizona|nevada|dunes|marrakech/.test(text))
    return 'desert';
  if (/paris|london|new york|tokyo|berlin|rome|city|manhattan|urban|metro|nyc/.test(text))
    return 'urban';
  return 'default';
}

// ── Noise buffer generators ───────────────────────────────────────────────────
function createNoiseBuffer(ctx, type) {
  const n = ctx.sampleRate * 4;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);

  if (type === 'white') {
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  } else if (type === 'brown') {
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      d[i] = (last + 0.02 * w) / 1.02;
      last = d[i];
      d[i] *= 3.5;
    }
  } else {
    // pink
    let b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0=0.99886*b0+w*0.0555179; b1=0.99332*b1+w*0.0750759;
      b2=0.96900*b2+w*0.1538520; b3=0.86650*b3+w*0.3104856;
      b4=0.55000*b4+w*0.5329522; b5=-0.7616*b5-w*0.0168980;
      d[i]=(b0+b1+b2+b3+b4+b5+b6+w*0.5362)*0.11; b6=w*0.115926;
    }
  }
  return buf;
}

function makeNoise(ctx, dest, type, filterType, freq, Q, vol) {
  const src = ctx.createBufferSource();
  src.buffer = createNoiseBuffer(ctx, type);
  src.loop = true;
  const filt = ctx.createBiquadFilter();
  filt.type = filterType; filt.frequency.value = freq; filt.Q.value = Q;
  const gain = ctx.createGain(); gain.gain.value = vol;
  src.connect(filt); filt.connect(gain); gain.connect(dest);
  src.start();
  return { src, filt };
}

function makeOsc(ctx, dest, type, freq, vol) {
  const osc = ctx.createOscillator();
  osc.type = type; osc.frequency.value = freq;
  const gain = ctx.createGain(); gain.gain.value = vol;
  osc.connect(gain); gain.connect(dest);
  osc.start();
  return osc;
}

// ── Soundscape builder ────────────────────────────────────────────────────────
function buildSoundscape(ctx, vibe, master) {
  const nodes = [];

  if (vibe === 'coastal') {
    const { filt } = makeNoise(ctx, master, 'brown', 'lowpass', 320, 0.7, 0.55);
    // LFO wave modulation
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 140;
    lfo.connect(lfoGain); lfoGain.connect(filt.frequency);
    lfo.start(); nodes.push(lfo);
    makeNoise(ctx, master, 'white', 'bandpass', 2200, 2.5, 0.04);

  } else if (vibe === 'mountain') {
    makeNoise(ctx, master, 'white', 'bandpass', 180, 0.25, 0.28);
    nodes.push(makeOsc(ctx, master, 'sine', 55, 0.07));
    nodes.push(makeOsc(ctx, master, 'sine', 82, 0.035));

  } else if (vibe === 'jungle') {
    makeNoise(ctx, master, 'pink', 'bandpass', 650, 0.45, 0.45);
    makeNoise(ctx, master, 'white', 'highpass', 3200, 0.6, 0.025);
    nodes.push(makeOsc(ctx, master, 'sine', 110, 0.05));

  } else if (vibe === 'desert') {
    makeNoise(ctx, master, 'white', 'lowpass', 130, 0.3, 0.13);
    nodes.push(makeOsc(ctx, master, 'sine', 60, 0.04));

  } else if (vibe === 'urban') {
    makeNoise(ctx, master, 'brown', 'bandpass', 260, 0.5, 0.35);
    makeNoise(ctx, master, 'white', 'bandpass', 850, 1.2, 0.04);
    nodes.push(makeOsc(ctx, master, 'sawtooth', 60, 0.025));

  } else {
    makeNoise(ctx, master, 'brown', 'lowpass', 200, 0.5, 0.25);
    nodes.push(makeOsc(ctx, master, 'sine', 80, 0.04));
  }

  return nodes;
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useAmbientSound(locations, isPlaying) {
  const ambientRef = useRef(null);
  const vibe = useMemo(() => detectVibe(locations), [locations?.join(',')]);

  // Fade in/out on play state change
  useEffect(() => {
    if (!isPlaying) {
      if (ambientRef.current) {
        const { ctx, master } = ambientRef.current;
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(0, ctx.currentTime + 2.5);
      }
      return;
    }

    // Lazy init on first play (requires user gesture — guaranteed here since user pressed play)
    if (!ambientRef.current) {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const master = ctx.createGain();
      master.gain.value = 0;
      master.connect(ctx.destination);
      const nodes = buildSoundscape(ctx, vibe, master);
      ambientRef.current = { ctx, master, nodes };
    }

    const { ctx, master } = ambientRef.current;
    if (ctx.state === 'suspended') ctx.resume();
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0.40, ctx.currentTime + 3.0);
  }, [isPlaying]);

  // Cleanup on unmount
  useEffect(() => () => {
    if (ambientRef.current) {
      const { ctx, nodes } = ambientRef.current;
      for (const n of nodes) { try { n.stop(); } catch {} }
      ctx.close();
      ambientRef.current = null;
    }
  }, []);
}

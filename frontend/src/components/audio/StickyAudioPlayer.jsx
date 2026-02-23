import { useRef, useState, useEffect } from 'react';
import './StickyAudioPlayer.css';

export default function StickyAudioPlayer({ audioUrl, onTimeUpdate }) {
  const audioRef  = useRef(null);
  const [playing, setPlaying]   = useState(false);
  const [current, setCurrent]   = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume]     = useState(0.8);

  // When URL changes, force the audio element to reload and reset UI state
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.pause();
    el.load();
    setPlaying(false);
    setCurrent(0);
    setDuration(0);
  }, [audioUrl]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.volume = volume;

    const onTime     = () => {
      setCurrent(el.currentTime);
      onTimeUpdate?.(el.currentTime, el.duration || 0);
    };
    const onMeta     = () => setDuration(el.duration);
    const onEnded    = () => setPlaying(false);
    const onPlay     = () => setPlaying(true);
    const onPause    = () => setPlaying(false);

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('ended', onEnded);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
    };
  }, [audioUrl]);

  function togglePlay() {
    const el = audioRef.current;
    if (!el) return;
    playing ? el.pause() : el.play();
  }

  function handleSeek(e) {
    const el = audioRef.current;
    if (!el || !duration) return;
    el.currentTime = (e.target.value / 1000) * duration;
  }

  function handleVolume(e) {
    const v = e.target.value / 100;
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
  }

  function fmt(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  async function downloadAudio() {
    try {
      const res = await fetch(audioUrl);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'memoir-voiceover.wav';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error('[audio] Download failed:', e);
    }
  }

  if (!audioUrl) return null;

  return (
    <div className="audio-player">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <button
        className={`audio-player__play ${playing ? 'audio-player__play--pause' : ''}`}
        onClick={togglePlay}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? '⏸' : '▶'}
      </button>

      <div className="audio-player__info">
        <span className="audio-player__label">Memoir voiceover</span>
        <div className="audio-player__scrubber-wrap">
          <span className="audio-player__time">{fmt(current)}</span>
          <input
            type="range"
            className="audio-player__scrubber"
            min={0}
            max={1000}
            value={duration ? (current / duration) * 1000 : 0}
            onChange={handleSeek}
          />
          <span className="audio-player__time">{fmt(duration)}</span>
        </div>
      </div>

      <div className="audio-player__volume">
        <span className="audio-player__vol-icon">{volume === 0 ? '🔇' : '🔊'}</span>
        <input
          type="range"
          className="audio-player__vol-slider"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={handleVolume}
        />
      </div>

      <button
        className="audio-player__download"
        onClick={downloadAudio}
        title="Download WAV"
      >
        ↓
      </button>
    </div>
  );
}

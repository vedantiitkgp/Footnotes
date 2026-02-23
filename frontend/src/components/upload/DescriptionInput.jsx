import React, { useRef, useState } from 'react';
import './DescriptionInput.css';

const PLACEHOLDER = `Describe your trip — where did you go, what did you feel, any special moments you want woven into the story?

Example: "Three weeks across Morocco — Marrakech's souks, the Sahara at dawn, the blue city of Chefchaouen in the rain. I was travelling alone and felt wonderfully lost the whole time."`;

export default function DescriptionInput({ value, onChange, onVoiceTranscript }) {
  const [isRecording, setIsRecording] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef   = useRef([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        // Simple: append a placeholder — real transcription via backend or Web Speech API
        if (window.SpeechRecognition || window.webkitSpeechRecognition) return;
        onVoiceTranscript?.('[Voice note recorded — transcription not available in this browser]');
      };
      rec.start();
      recorderRef.current = rec;
      setIsRecording(true);
    } catch {
      console.warn('Mic access denied');
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setIsRecording(false);
  }

  function toggleRecording() {
    isRecording ? stopRecording() : startRecording();
  }

  return (
    <div className="description-input">
      <div className="description-input__header">
        <label className="description-input__label" htmlFor="trip-description">
          Trip description
        </label>
        <button
          type="button"
          className={`voice-btn ${isRecording ? 'voice-btn--recording' : ''}`}
          onClick={toggleRecording}
          title={isRecording ? 'Stop recording' : 'Speak your description'}
        >
          {isRecording ? '⏹ Stop' : '🎙 Voice'}
        </button>
      </div>
      <textarea
        id="trip-description"
        className="description-input__textarea"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={PLACEHOLDER}
        rows={6}
      />
      <p className="description-input__hint">
        {value.length} characters · The more detail, the richer the memoir
      </p>
    </div>
  );
}

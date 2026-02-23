import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import DropZone from '../components/upload/DropZone.jsx';
import PhotoGrid from '../components/upload/PhotoGrid.jsx';
import DescriptionInput from '../components/upload/DescriptionInput.jsx';
import StyleSelector from '../components/upload/StyleSelector.jsx';
import { useMemoir } from '../context/MemoirContext.jsx';
import './UploadPage.css';

const PAGE_TRANSITION = {
  initial:   { opacity: 0, y: 20 },
  animate:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' } },
  exit:      { opacity: 0, y: -20, transition: { duration: 0.3 } },
};

export default function UploadPage() {
  const navigate = useNavigate();
  const { dispatch } = useMemoir();

  const [files, setFiles]             = useState([]);
  const [description, setDescription] = useState('');
  const [style, setStyle]             = useState('literary');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (files.length === 0) { setError('Please add at least one photo.'); return; }
    if (description.trim().length < 20) { setError('Please add a description (min 20 chars).'); return; }

    setLoading(true);
    setError('');
    dispatch({ type: 'RESET' });

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append('photos', f));
      formData.append('description', description);
      formData.append('style', style);

      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Upload failed (${res.status})`);
      }
      const { sessionId } = await res.json();
      dispatch({ type: 'SET_SESSION', payload: sessionId });
      navigate(`/loading/${sessionId}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <motion.div className="upload-page" {...PAGE_TRANSITION}>
      <div className="upload-page__header">
        <h1 className="upload-page__title">
          Begin your<br /><em>memoir</em>
        </h1>
        <p className="upload-page__subtitle">
          Upload your travel photos and describe your journey.<br />
          Our AI will craft a literary essay with a voiceover and map.
        </p>
      </div>

      <form className="upload-form" onSubmit={handleSubmit}>
        <section className="upload-form__section">
          <DropZone files={files} onFilesChange={setFiles} />
          <PhotoGrid files={files} onRemove={removeFile} />
        </section>

        <section className="upload-form__section">
          <DescriptionInput
            value={description}
            onChange={setDescription}
            onVoiceTranscript={(t) => setDescription((p) => p + (p ? '\n' : '') + t)}
          />
        </section>

        <section className="upload-form__section">
          <StyleSelector value={style} onChange={setStyle} />
        </section>

        {error && <p className="upload-form__error">{error}</p>}

        <button
          type="submit"
          className="upload-form__submit"
          disabled={loading || files.length === 0}
        >
          {loading ? (
            <span className="upload-form__spinner" />
          ) : (
            <>Create my memoir →</>
          )}
        </button>
      </form>
    </motion.div>
  );
}

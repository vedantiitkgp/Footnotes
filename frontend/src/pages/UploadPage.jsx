import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import DropZone from '../components/upload/DropZone.jsx';
import PhotoGrid from '../components/upload/PhotoGrid.jsx';
import GooglePhotosButton from '../components/upload/GooglePhotosButton.jsx';
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
  const [googlePicked, setGooglePicked] = useState(null);
  const [description, setDescription] = useState('');
  const [style, setStyle]             = useState('literary');
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState('');

  function removeFile(index) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (files.length === 0 && !googlePicked) { setError('Please add at least one photo.'); return; }
    if (description.trim().length < 20) { setError('Please add a description (min 20 chars).'); return; }

    setLoading(true);
    setError('');
    dispatch({ type: 'RESET' });

    try {
      let res;
      if (googlePicked) {
        res = await fetch('/api/photos/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...googlePicked, description, style }),
        });
      } else {
        const formData = new FormData();
        files.forEach((f) => formData.append('photos', f));
        formData.append('description', description);
        formData.append('style', style);

        res = await fetch('/api/upload', { method: 'POST', body: formData });
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // The Google token or the picked baseUrls have expired — the only
        // remedy is picking again, so drop the stale selection.
        if (body.code === 'google_auth_expired') setGooglePicked(null);
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
        <Link to="/history" className="upload-page__history-link">
          My past memoirs →
        </Link>
      </div>

      <form className="upload-form" onSubmit={handleSubmit}>
        <section className="upload-form__section">
          {!googlePicked && (
            <>
              <DropZone files={files} onFilesChange={setFiles} />
              <PhotoGrid files={files} onRemove={removeFile} />
            </>
          )}
          <GooglePhotosButton
            picked={googlePicked}
            // Picking from Google replaces any local selection, so the two
            // sources stay mutually exclusive without greying the button out.
            onPicked={(selection) => { setGooglePicked(selection); setFiles([]); }}
            onClear={() => setGooglePicked(null)}
          />
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
          disabled={loading || (files.length === 0 && !googlePicked)}
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

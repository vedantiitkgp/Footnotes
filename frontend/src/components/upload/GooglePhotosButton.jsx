import React, { useEffect, useRef, useState } from 'react';
import './GooglePhotosButton.css';

const GIS_SRC    = 'https://accounts.google.com/gsi/client';
const SCOPE      = 'https://www.googleapis.com/auth/photospicker.mediaitems.readonly';
const PICKER_API = 'https://photospicker.googleapis.com/v1';
const MAX_ITEMS  = 20;

// Loaded lazily and once — putting this in index.html would pull Google's
// script for every visitor even when the feature is switched off.
let gisPromise = null;
function loadGis() {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(s);
  });
  return gisPromise;
}

// pollingConfig values are protobuf Durations serialised as "5s".
function durationMs(value, fallback) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n * 1000 : fallback;
}

function GoogleMark() {
  return (
    <svg className="gphotos__mark" viewBox="0 0 48 48" width="18" height="18" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function GooglePhotosButton({ picked, onPicked, onClear, disabled = false }) {
  const [enabled, setEnabled]     = useState(false);
  const [ready, setReady]         = useState(false);
  const [status, setStatus]       = useState('idle');   // idle | authorizing | waiting | fetching
  const [pickerUri, setPickerUri] = useState('');
  const [error, setError]         = useState('');

  const tokenClientRef = useRef(null);
  const cancelledRef   = useRef(false);
  const handleTokenRef = useRef(() => {});

  useEffect(() => () => { cancelledRef.current = true; }, []);

  function reset() {
    setStatus('idle');
    setPickerUri('');
  }

  function cancel() {
    cancelledRef.current = true;
    reset();
  }

  async function pollUntilPicked(sessionId, token, pollingConfig) {
    const interval = durationMs(pollingConfig?.pollInterval, 5000);
    const deadline = Date.now() + durationMs(pollingConfig?.timeoutIn, 300000);

    // setTimeout inside an await loop, not setInterval — iterations can't stack.
    while (!cancelledRef.current) {
      if (Date.now() > deadline) throw new Error('The picker timed out — please try again.');
      await new Promise((r) => setTimeout(r, interval));
      if (cancelledRef.current) return null;

      const res = await fetch(`${PICKER_API}/sessions/${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 404 || res.status === 410) {
        throw new Error('That picker session expired — please try again.');
      }
      if (!res.ok) continue;

      const session = await res.json();
      if (session.mediaItemsSet) return session;
    }
    return null;
  }

  async function handleToken(response) {
    const token = response?.access_token;
    if (!token) { setError('Google did not return an access token.'); reset(); return; }

    cancelledRef.current = false;
    setError('');
    setStatus('waiting');

    let sessionId = null;
    try {
      const created = await fetch(`${PICKER_API}/sessions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        // maxItemCount is an int64 — the API serialises it as a string.
        body: JSON.stringify({ pickingConfig: { maxItemCount: String(MAX_ITEMS) } }),
      });
      if (!created.ok) throw new Error(`Could not start the Google picker (${created.status}).`);

      const session = await created.json();
      sessionId = session.id;
      setPickerUri(session.pickerUri || '');

      // This runs inside an async callback, so it is outside the user gesture
      // and some browsers will block it. The visible link below is the fallback.
      window.open(`${session.pickerUri}/autoclose`, '_blank', 'noopener');

      const done = await pollUntilPicked(sessionId, token, session.pollingConfig);
      if (!done || cancelledRef.current) return;

      setStatus('fetching');
      const listed = await fetch(
        `${PICKER_API}/mediaItems?sessionId=${encodeURIComponent(sessionId)}&pageSize=100`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!listed.ok) throw new Error(`Could not read your selection (${listed.status}).`);

      const { mediaItems = [] } = await listed.json();
      // Send only what the backend needs — express.json() caps bodies at 100kb.
      const items = mediaItems
        .filter((m) => m?.mediaFile?.baseUrl)
        .slice(0, MAX_ITEMS)
        .map((m) => ({
          baseUrl:  m.mediaFile.baseUrl,
          filename: m.mediaFile.filename,
          mimeType: m.mediaFile.mimeType,
        }));

      if (items.length === 0) throw new Error('No photos were selected.');

      onPicked({ accessToken: token, items });
      reset();
    } catch (err) {
      if (!cancelledRef.current) setError(err.message);
      reset();
    } finally {
      // Politeness, not correctness — picker sessions expire on their own.
      if (sessionId) {
        fetch(`${PICKER_API}/sessions/${encodeURIComponent(sessionId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    }
  }
  handleTokenRef.current = handleToken;

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/photos/config');
        const cfg = await res.json();
        if (!alive || !cfg.enabled) return;
        setEnabled(true);

        await loadGis();
        if (!alive) return;

        tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
          client_id: cfg.clientId,
          scope: SCOPE,
          callback: (r) => handleTokenRef.current(r),
          error_callback: (err) => {
            if (err?.type === 'popup_closed') { reset(); return; }   // user changed their mind
            setError(err?.type === 'popup_failed_to_open'
              ? 'Your browser blocked the Google sign-in window. Allow popups for this site and try again.'
              : 'Google sign-in failed. Please try again.');
            reset();
          },
        });
        setReady(true);
      } catch {
        // Config unreachable or GIS blocked — leave the feature hidden.
      }
    })();
    return () => { alive = false; };
  }, []);

  if (!enabled) return null;

  const busy = status !== 'idle';

  if (picked) {
    return (
      <div className="gphotos">
        <p className="gphotos__picked-title">
          {picked.items.length} photo{picked.items.length === 1 ? '' : 's'} from Google Photos
        </p>
        <ul className="gphotos__chips">
          {picked.items.map((item, i) => (
            <li key={`${item.baseUrl}-${i}`} className="gphotos__chip">
              {item.filename || `Photo ${i + 1}`}
            </li>
          ))}
        </ul>
        <button type="button" className="gphotos__link" onClick={onClear}>
          Clear selection
        </button>
      </div>
    );
  }

  return (
    <div className="gphotos">
      <button
        type="button"
        className="gphotos__btn"
        // Only genuinely unclickable states disable it: still wiring up Google's
        // script, or a pick already in flight. Having local files does NOT
        // disable it — picking from Google just replaces them.
        disabled={!ready || busy || disabled}
        // requestAccessToken() MUST be the first synchronous statement here —
        // anything awaited before it breaks the user-gesture chain and the
        // browser blocks the popup.
        onClick={() => { tokenClientRef.current?.requestAccessToken(); setStatus('authorizing'); }}
      >
        <GoogleMark />
        {busy ? 'Waiting for your selection…' : !ready ? 'Connecting to Google…' : 'Import from Google Photos'}
      </button>

      {busy && (
        <div className="gphotos__status">
          {pickerUri && (
            <a
              className="gphotos__link"
              href={`${pickerUri}/autoclose`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open the Google Photos picker →
            </a>
          )}
          <button type="button" className="gphotos__link" onClick={cancel}>Cancel</button>
        </div>
      )}

      {error && <p className="gphotos__error">{error}</p>}
    </div>
  );
}

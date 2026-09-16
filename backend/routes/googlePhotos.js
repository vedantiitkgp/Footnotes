import express from 'express';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { createSession, updateSession } from '../services/sessionStore.js';
import { googlePhotosEnabled, downloadPickedItems } from '../services/googlePhotos.js';

const router = express.Router();

const MAX_ITEMS = 20;   // matches multer's files limit in upload.js

// An OAuth Web Client ID is public by design — it ships in every GIS request.
// Serving it here keeps the frontend free of build-time env plumbing.
router.get('/config', (_req, res) => {
  res.json(
    googlePhotosEnabled
      ? { enabled: true, clientId: process.env.GOOGLE_PHOTOS_CLIENT_ID }
      : { enabled: false },
  );
});

router.post('/import', async (req, res) => {
  if (!googlePhotosEnabled) {
    return res.status(503).json({ error: 'Google Photos import is not configured' });
  }

  const { accessToken, items, description = '', style = 'literary' } = req.body || {};

  if (typeof accessToken !== 'string' || !accessToken) {
    return res.status(400).json({ error: 'Missing Google access token' });
  }
  // The browser also caps selection via pickingConfig.maxItemCount, but that
  // is a client-side cap and cannot be trusted.
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ITEMS) {
    return res.status(400).json({ error: `Select between 1 and ${MAX_ITEMS} photos` });
  }

  const sessionId = uuidv4();
  const sessionDir = createSession(sessionId, { description: '', style: 'literary', photoCount: 0 });

  try {
    const { filenames, authExpired } = await downloadPickedItems(sessionDir, items, accessToken);

    if (filenames.length === 0) {
      // Never leave a session with zero photoFiles — generate.js would fall
      // back to reading an empty dir and produce a memoir with no photos.
      fs.rmSync(sessionDir, { recursive: true, force: true });
      if (authExpired) {
        return res.status(401).json({
          code: 'google_auth_expired',
          error: 'Your Google session expired — please pick your photos again',
        });
      }
      return res.status(502).json({ error: 'Could not download any photos from Google Photos' });
    }

    updateSession(sessionId, {
      description,
      style,
      photoCount: filenames.length,
      photoFiles: filenames,
    });

    // Never log the token or the request body.
    console.log(`[googlePhotos] Session ${sessionId}: ${filenames.length}/${items.length} items downloaded, style=${style}`);
    res.json({ sessionId });
  } catch (err) {
    fs.rmSync(sessionDir, { recursive: true, force: true });
    console.error('[googlePhotos] Import failed:', err.message);
    res.status(500).json({ error: 'Google Photos import failed' });
  }
});

export default router;

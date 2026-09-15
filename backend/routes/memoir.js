import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getSessionDir } from '../services/sessionStore.js';
import { supabaseEnabled, publicUrl, listMemoirs, getMemoir, deleteMemoir } from '../services/supabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, '..', 'temp');

const router = express.Router();

// GET /api/memoirs — list all memoirs (summaries only)
router.get('/', async (_req, res) => {
  if (supabaseEnabled) {
    try {
      const rows = await listMemoirs();
      return res.json(rows.map((r) => ({
        sessionId: r.session_id,
        title: r.data?.structure?.chapters?.[0]?.title || 'A Journey in Words',
        locations: r.data?.structure?.locations || [],
        createdAt: r.data?.createdAt || r.created_at,
      })));
    } catch (err) {
      console.error('[memoir] list failed:', err.message);
      return res.status(500).json({ error: 'Failed to list memoirs' });
    }
  }

  if (!fs.existsSync(TEMP_DIR)) return res.json([]);

  let entries;
  try {
    entries = fs.readdirSync(TEMP_DIR, { withFileTypes: true });
  } catch {
    return res.json([]);
  }

  const memoirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const memoirJsonPath = path.join(TEMP_DIR, entry.name, 'memoir.json');
    if (!fs.existsSync(memoirJsonPath)) continue;
    try {
      const data = JSON.parse(fs.readFileSync(memoirJsonPath, 'utf8'));
      memoirs.push({
        sessionId: data.sessionId || entry.name,
        title: data.structure?.chapters?.[0]?.title || 'A Journey in Words',
        locations: data.structure?.locations || [],
        createdAt: data.createdAt,
      });
    } catch {
      // skip corrupted entries
    }
  }

  // Sort newest first
  memoirs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(memoirs);
});

// GET /api/memoir/:sessionId
router.get('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  if (supabaseEnabled) {
    try {
      const data = await getMemoir(sessionId);
      if (!data) return res.status(404).json({ error: 'Memoir not found' });
      return res.json({
        essay: data.essay,
        structure: data.structure,
        stats: data.stats,
        postcards: (data.postcards || []).map((p) => ({
          index: p.index,
          url: publicUrl(`${sessionId}/assets/${p.filename}`),
        })),
        audioUrl: data.audioFilename ? publicUrl(`${sessionId}/assets/${data.audioFilename}`) : null,
        photoUrls: (data.photoFiles || []).map((f) => publicUrl(`${sessionId}/photos/${f}`)),
        whatIf: data.whatIf || [],
        createdAt: data.createdAt,
      });
    } catch (err) {
      console.error('[memoir] get failed:', err.message);
      return res.status(500).json({ error: 'Failed to read memoir' });
    }
  }

  const sessionDir = getSessionDir(sessionId);
  const memoirJsonPath = path.join(sessionDir, 'memoir.json');

  if (!fs.existsSync(memoirJsonPath)) {
    return res.status(404).json({ error: 'Memoir not found' });
  }

  let memoirData;
  try {
    memoirData = JSON.parse(fs.readFileSync(memoirJsonPath, 'utf8'));
  } catch {
    return res.status(500).json({ error: 'Failed to read memoir data' });
  }

  // Reconstruct asset URLs
  const postcards = (memoirData.postcards || []).map((p) => ({
    index: p.index,
    url: `/api/assets/${sessionId}/${p.filename}`,
  }));

  const audioUrl = memoirData.audioFilename
    ? `/api/assets/${sessionId}/${memoirData.audioFilename}`
    : null;

  // Prefer saved photoFiles; fall back to scanning the photos dir on disk
  let photoFiles = memoirData.photoFiles;
  if (!photoFiles?.length) {
    const photosDir = path.join(sessionDir, 'photos');
    try {
      photoFiles = fs.readdirSync(photosDir).filter(
        (f) => f !== '.gitkeep' && /\.(jpe?g|png|webp|gif|heic)$/i.test(f)
      );
    } catch {
      photoFiles = [];
    }
  }
  const photoUrls = photoFiles.map((f) => `/api/assets/${sessionId}/${f}`);

  res.json({
    essay: memoirData.essay,
    structure: memoirData.structure,
    stats: memoirData.stats,
    postcards,
    audioUrl,
    photoUrls,
    whatIf: memoirData.whatIf || [],
    createdAt: memoirData.createdAt,
  });
});

// DELETE /api/memoir/:sessionId — remove session + all generated assets
router.delete('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;

  // Basic validation — sessionId should be a UUID-like string, no path traversal
  if (!/^[\w-]{8,}$/.test(sessionId)) {
    return res.status(400).json({ error: 'Invalid sessionId' });
  }

  if (supabaseEnabled) {
    try {
      await deleteMemoir(sessionId);
      // Best-effort local cleanup too (in case a live-session copy exists)
      fs.rmSync(getSessionDir(sessionId), { recursive: true, force: true });
      return res.json({ ok: true });
    } catch (err) {
      console.error('[memoir] DELETE (supabase) failed:', err.message);
      return res.status(500).json({ error: 'Failed to delete memoir' });
    }
  }

  const sessionDir = getSessionDir(sessionId);

  if (!fs.existsSync(sessionDir)) {
    return res.status(404).json({ error: 'Session not found' });
  }

  try {
    fs.rmSync(sessionDir, { recursive: true, force: true });
    res.json({ ok: true });
  } catch (err) {
    console.error('[memoir] DELETE failed:', err.message);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;

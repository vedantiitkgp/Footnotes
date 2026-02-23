import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getSessionDir } from '../services/sessionStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, '..', 'temp');

const router = express.Router();

// GET /api/memoirs — list all memoirs on disk (summaries only)
router.get('/', (_req, res) => {
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
router.get('/:sessionId', (req, res) => {
  const { sessionId } = req.params;
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

  res.json({
    essay: memoirData.essay,
    structure: memoirData.structure,
    stats: memoirData.stats,
    postcards,
    audioUrl,
    createdAt: memoirData.createdAt,
  });
});

export default router;

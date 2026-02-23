import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getSessionDir } from '../services/sessionStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router    = express.Router();

// GET /api/assets/:sessionId/:filename
// Does NOT require session to be in memory — checks disk directly.
// This survives server restarts because files persist in temp/.
router.get('/:sessionId/:filename', (req, res) => {
  const { sessionId, filename } = req.params;

  // Basic security: no path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const sessionDir = getSessionDir(sessionId);

  // Look in assets/ first, then photos/
  const candidates = [
    path.join(sessionDir, 'assets', filename),
    path.join(sessionDir, 'photos', filename),
  ];

  const filePath = candidates.find((p) => fs.existsSync(p));

  if (!filePath) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.sendFile(filePath, (err) => {
    if (err && !res.headersSent) {
      console.error(`[assets] sendFile failed for ${filePath}:`, err.message);
      res.status(500).json({ error: 'Failed to serve file' });
    }
  });
});

export default router;

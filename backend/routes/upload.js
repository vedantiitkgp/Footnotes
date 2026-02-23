import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { createSession, updateSession, getSessionDir } from '../services/sessionStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Multer storage: destination called per-file, so we store sessionId on req
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    if (!req.sessionId) {
      req.sessionId = uuidv4();
      createSession(req.sessionId, { description: '', style: 'literary', photoCount: 0 });
    }
    cb(null, path.join(getSessionDir(req.sessionId), 'photos'));
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are accepted'));
  },
});

router.post('/', upload.array('photos', 20), (req, res) => {
  try {
    const { sessionId } = req;
    const { description = '', style = 'literary' } = req.body;
    const files = req.files || [];

    if (!sessionId || files.length === 0) {
      return res.status(400).json({ error: 'No photos uploaded' });
    }

    updateSession(sessionId, {
      description,
      style,
      photoCount: files.length,
      photoFiles: files.map((f) => f.filename),
    });

    console.log(`[upload] Session ${sessionId}: ${files.length} photos, style=${style}`);
    res.json({ sessionId });
  } catch (err) {
    console.error('[upload] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

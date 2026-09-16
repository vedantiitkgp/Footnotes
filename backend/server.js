// .env is loaded via node --env-file=../.env (see package.json dev script)
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import uploadRouter from './routes/upload.js';
import generateRouter from './routes/generate.js';
import assetsRouter from './routes/assets.js';
import memoirRouter from './routes/memoir.js';
import geocodeRouter from './routes/geocode.js';
import googlePhotosRouter from './routes/googlePhotos.js';
import { startCleanupCron } from './services/sessionStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const isProd = process.env.NODE_ENV === 'production';

// In dev, restrict to Vite dev server. In prod, frontend is same-origin.
app.use(cors({
  origin: isProd ? true : 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

app.use('/api/upload', uploadRouter);
app.use('/api/generate', generateRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/memoir', memoirRouter);
app.use('/api/geocode', geocodeRouter);
app.use('/api/photos', googlePhotosRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// In production, serve the built React frontend and handle SPA routing
if (isProd) {
  const publicDir = path.join(__dirname, 'public');
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
}

startCleanupCron();

app.listen(PORT, () => {
  console.log(`[server] Memoir backend running on http://localhost:${PORT}`);
  console.log(`[server] GEMINI_API_KEY loaded: ${process.env.GEMINI_API_KEY ? 'yes ✓' : 'NO — check .env!'}`);
});

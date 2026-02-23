import express from 'express';
import path from 'path';
import fs from 'fs';
import { getSession, getSessionDir } from '../services/sessionStore.js';
import { analyzePhotos, streamEssay } from '../services/geminiService.js';
import { generateAllPostcards } from '../services/imagenService.js';
import { generateVoiceover } from '../services/ttsService.js';

const router = express.Router();

// Helper: send a typed SSE event
function sendEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

// GET /api/generate/:sessionId
router.get('/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  const session = getSession(sessionId);

  if (!session) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  // Keep-alive ping every 15s
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 15000);

  const sessionDir = getSessionDir(sessionId);
  const photosDir  = path.join(sessionDir, 'photos');
  const assetsDir  = path.join(sessionDir, 'assets');

  try {
    // ── Stage 1: Photo analysis (5 → 25%) ───────────────────────────────────
    sendEvent(res, 'progress', { stage: 'analyzing', percent: 5, message: 'Reading your photos…' });

    const photoFiles = session.photoFiles || fs.readdirSync(photosDir).filter((f) => f !== '.gitkeep');
    const photoPaths = photoFiles.map((f) => path.join(photosDir, f));

    sendEvent(res, 'progress', { stage: 'analyzing', percent: 12, message: 'Understanding locations and moods…' });
    const analysis = await analyzePhotos(photoPaths);
    console.log('[generate] Analysis:', JSON.stringify(analysis).slice(0, 200));

    sendEvent(res, 'progress', { stage: 'analyzing', percent: 25, message: 'Photos analyzed — crafting your story…' });

    // Emit initial structure event (chapters will be updated after essay completes)
    sendEvent(res, 'structure', {
      locations: analysis.locations || [],
      chapters: [],
    });

    // ── Stage 2: Essay streaming (25 → 70%) ─────────────────────────────────
    sendEvent(res, 'progress', { stage: 'writing', percent: 30, message: 'Writing your memoir…' });

    let chunkCount = 0;
    const fullEssay = await streamEssay({
      description: session.description,
      style: session.style || 'literary',
      analysis,
      photoPaths,
      onChunk: (text) => {
        sendEvent(res, 'text_chunk', { text });
        chunkCount++;
        // Progress from 30 → 68 during essay streaming
        if (chunkCount % 10 === 0) {
          const pct = Math.min(68, 30 + Math.floor(chunkCount / 5));
          sendEvent(res, 'progress', { stage: 'writing', percent: pct, message: 'Weaving your narrative…' });
        }
      },
    });

    // Extract actual chapter titles from completed essay
    const chapterTitles = extractChapterTitles(fullEssay);
    sendEvent(res, 'structure', { locations: analysis.locations || [], chapters: chapterTitles });
    sendEvent(res, 'progress', { stage: 'writing', percent: 70, message: 'Essay complete — creating postcards…' });

    // ── Stage 3: Imagen postcards (70 → 85%) ────────────────────────────────
    sendEvent(res, 'progress', { stage: 'postcards', percent: 72, message: 'Generating AI travel postcards…' });

    await generateAllPostcards({
      gaps: analysis.gaps || [],
      locations: analysis.locations || [],
      assetsDir,
      onPostcard: ({ index, filename }) => {
        const url = `/api/assets/${sessionId}/${filename}`;
        sendEvent(res, 'postcard', { index, url });
        sendEvent(res, 'progress', {
          stage: 'postcards',
          percent: 72 + (index + 1) * 3,
          message: `Postcard ${index + 1} created…`,
        });
      },
    });

    sendEvent(res, 'progress', { stage: 'postcards', percent: 85, message: 'Postcards done — recording voiceover…' });

    // ── Stage 4: TTS voiceover (85 → 95%) ───────────────────────────────────
    sendEvent(res, 'progress', { stage: 'audio', percent: 87, message: 'Recording your memoir aloud…' });

    const audioFilename = await generateVoiceover({ text: fullEssay, assetsDir });
    if (audioFilename) {
      sendEvent(res, 'audio', { url: `/api/assets/${sessionId}/${audioFilename}` });
    }
    sendEvent(res, 'progress', { stage: 'audio', percent: 95, message: 'Almost there…' });

    // ── Stage 5: Stats + complete ────────────────────────────────────────────
    const wordCount = fullEssay.split(/\s+/).filter(Boolean).length;
    sendEvent(res, 'stats', {
      locations: analysis.locations?.length || 0,
      days: analysis.days || 0,
      photoCount: photoFiles.length,
      wordCount,
    });

    sendEvent(res, 'progress', { stage: 'complete', percent: 100, message: 'Your memoir is ready!' });
    sendEvent(res, 'complete', { sessionId });

  } catch (err) {
    console.error('[generate] Pipeline error:', err);
    sendEvent(res, 'error', { code: err.code || 'PIPELINE_ERROR', message: err.message });
  } finally {
    clearInterval(keepAlive);
    res.end();
  }
});

function extractChapterTitles(text) {
  const matches = text.match(/^##\s+(.+)$/gm) || [];
  return matches.map((m) => ({ title: m.replace(/^##\s+/, '') }));
}

export default router;

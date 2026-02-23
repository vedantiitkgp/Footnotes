import express from 'express';
import path from 'path';
import fs from 'fs';
import { getSession, getSessionDir } from '../services/sessionStore.js';
import { analyzePhotos, streamEssay, generateWhatIf, extractLocationsFromEssay } from '../services/geminiService.js';
import { analyzeWithVision, isVisionEnabled } from '../services/visionService.js';
import { extractPhotoMetadata, buildExifContext } from '../services/exifService.js';
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

    // Send photo URLs immediately so the reel is available on MemoirPage
    sendEvent(res, 'photos', { urls: photoFiles.map((f) => `/api/assets/${sessionId}/${f}`) });

    sendEvent(res, 'progress', { stage: 'analyzing', percent: 12, message: 'Understanding locations and moods…' });

    // Run Gemini analysis, Vision API, and EXIF extraction in parallel
    const [analysis, visionData, exifMeta] = await Promise.all([
      analyzePhotos(photoPaths),
      isVisionEnabled() ? analyzeWithVision(photoPaths) : Promise.resolve(null),
      extractPhotoMetadata(photoPaths),
    ]);

    // Enrich analysis with GPS-confirmed locations and real timestamps from EXIF
    if (exifMeta.length > 0) {
      const exif = await buildExifContext(exifMeta);
      if (exif.gpsLocations.length > 0) {
        // GPS locations are high-confidence — prepend so essay uses them
        analysis.locations = [...new Set([...exif.gpsLocations, ...(analysis.locations || [])])];
        analysis.gpsLocations = exif.gpsLocations;
        console.log('[generate] EXIF GPS locations:', exif.gpsLocations);
      }
      if (exif.days !== null) {
        analysis.days = exif.days;
        console.log('[generate] EXIF trip duration:', exif.days, 'days');
      }
      if (exif.timestamps.length > 0) {
        const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        analysis.photoTimeline = `Photos taken ${fmt(exif.timestamps[0])} – ${fmt(exif.timestamps[exif.timestamps.length - 1])}`;
      }
    }

    // Merge Vision API results into analysis (Vision data takes priority for landmarks)
    if (visionData) {
      if (visionData.landmarks.length) {
        analysis.landmarks = [...new Set([...visionData.landmarks, ...(analysis.landmarks || [])])];
      }
      if (visionData.faceSnippets.length) {
        analysis.people = [...new Set([...(analysis.people || []), ...visionData.faceSnippets])];
      }
      if (visionData.signText.length) {
        analysis.signText = [...new Set([...(analysis.signText || []), ...visionData.signText])];
      }
      console.log('[generate] Vision API merged:', JSON.stringify(visionData).slice(0, 200));
    }

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
    // Send initial structure immediately so the frontend can start rendering
    sendEvent(res, 'structure', { locations: analysis.locations || [], chapters: chapterTitles });
    sendEvent(res, 'progress', { stage: 'writing', percent: 70, message: 'Essay complete — creating postcards…' });

    // ── Stage 3: Postcards + location extraction in parallel (70 → 85%) ──────
    sendEvent(res, 'progress', { stage: 'postcards', percent: 72, message: 'Generating AI travel postcards…' });

    const collectedPostcards = [];
    const [essayLocations] = await Promise.all([
      // Extract all place names from the essay text (runs while postcards generate)
      extractLocationsFromEssay(fullEssay).catch(() => []),

      generateAllPostcards({
        gaps: analysis.gaps || [],
        locations: analysis.locations || [],
        assetsDir,
        onPostcard: ({ index, filename }) => {
          const url = `/api/assets/${sessionId}/${filename}`;
          collectedPostcards.push({ index, filename });
          sendEvent(res, 'postcard', { index, url });
          sendEvent(res, 'progress', {
            stage: 'postcards',
            percent: 72 + (index + 1) * 3,
            message: `Postcard ${index + 1} created…`,
          });
        },
      }),
    ]);

    // Merge essay-extracted locations with photo-analysis locations (deduplicated)
    const mergedLocations = [...new Set([...essayLocations, ...(analysis.locations || [])])];
    analysis.locations = mergedLocations;
    console.log('[generate] Merged locations:', mergedLocations);

    // Send updated structure with full location list
    sendEvent(res, 'structure', { locations: mergedLocations, chapters: chapterTitles });
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
    const stats = {
      locations: analysis.locations?.length || 0,
      days: analysis.days || 0,
      photoCount: photoFiles.length,
      wordCount,
    };
    sendEvent(res, 'stats', stats);

    // Save memoir.json to session dir for persistence
    const memoirData = {
      sessionId,
      createdAt: new Date().toISOString(),
      essay: fullEssay,
      structure: { locations: analysis.locations || [], chapters: chapterTitles },
      stats,
      postcards: collectedPostcards,
      audioFilename: audioFilename || null,
      description: session.description,
      style: session.style || 'literary',
      photoFiles,
    };
    fs.writeFileSync(
      path.join(sessionDir, 'memoir.json'),
      JSON.stringify(memoirData, null, 2),
    );

    // ── Stage 6: What If? ──────────────────────────────────────────────────
    let whatIf = [];
    try {
      whatIf = await generateWhatIf({ locations: analysis.locations || [], essay: fullEssay });
      if (whatIf.length) sendEvent(res, 'what_if', { items: whatIf });
    } catch (err) {
      console.warn('[generate] what_if skipped:', err.message);
    }

    // Update memoir.json with whatIf
    memoirData.whatIf = whatIf;
    fs.writeFileSync(
      path.join(sessionDir, 'memoir.json'),
      JSON.stringify(memoirData, null, 2),
    );

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

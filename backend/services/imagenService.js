import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { withRetry } from './withRetry.js';

const retry = (fn) => withRetry(fn, { label: 'imagen', attempts: 2, baseDelayMs: 10000 });

function getAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

export async function generatePostcard({ gap, locations, index, assetsDir }) {
  const locationHint = locations?.[0] || 'a distant land';
  const prompt = `Editorial travel photography postcard. ${gap} in ${locationHint}.
Cinematic, golden hour light, film grain. National Geographic style. No text overlays.`;

  try {
    return await retry(async () => {
      const response = await getAI().models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt,
        config: { numberOfImages: 1, aspectRatio: '4:3' },
      });

      const imageData = response.generatedImages?.[0]?.image?.imageBytes;
      if (!imageData) throw new Error('No image data in Imagen response');

      const filename = `postcard_${index}.png`;
      fs.writeFileSync(path.join(assetsDir, filename), Buffer.from(imageData, 'base64'));
      console.log(`[imagen] Generated postcard ${index}`);
      return filename;
    });
  } catch (err) {
    console.error(`[imagen] Failed postcard ${index}:`, err.message);
    return null;
  }
}

export async function generateAllPostcards({ gaps, locations, assetsDir, onPostcard }) {
  // Generate postcards sequentially to avoid hammering rate limits
  const selected = (gaps || []).slice(0, 3);
  const results  = [];
  for (let i = 0; i < selected.length; i++) {
    const filename = await generatePostcard({ gap: selected[i], locations, index: i, assetsDir });
    if (filename) {
      onPostcard({ index: i, filename });
      results.push(filename);
    }
    // Small pause between imagen calls
    if (i < selected.length - 1) await new Promise((r) => setTimeout(r, 1000));
  }
  return results;
}

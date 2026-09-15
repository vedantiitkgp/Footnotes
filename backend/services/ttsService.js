import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { withRetry } from './withRetry.js';

function getAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

const retry = (fn) => withRetry(fn, { label: 'tts', attempts: 2, baseDelayMs: 10000 });

// Deepgram /v1/speak rejects text over 2000 chars per request (their own SDK
// enforces it: "Text exceeds 2000 character limit"). Memoir essays run 4-5k,
// so synthesise in chunks and concatenate the PCM before writing one header.
const DG_VOICE     = process.env.DEEPGRAM_VOICE || 'aura-2-thalia-en';
const DG_MAX_CHARS = 1900;   // headroom under the 2000 hard limit
const DG_RATE      = 24000;  // matches writeWav below

/** Split text into <=max-char pieces on sentence boundaries. Exported for tests. */
export function chunkText(text, max = DG_MAX_CHARS) {
  const pieces = text.match(/[^.!?\n]+[.!?]*\s*|\n+/g) || [text];
  const out = [];
  let buf = '';

  for (const piece of pieces) {
    if (buf.length + piece.length > max) {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      if (piece.length > max) {
        // A single sentence longer than the limit — hard-split it.
        for (let i = 0; i < piece.length; i += max) out.push(piece.slice(i, i + max).trim());
        continue;
      }
    }
    buf += piece;
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

async function deepgramSpeak(chunk) {
  const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(DG_VOICE)}`
            + `&encoding=linear16&sample_rate=${DG_RATE}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: chunk }),
  });

  if (!res.ok) {
    throw new Error(`Deepgram ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  let buf = Buffer.from(await res.arrayBuffer());
  // Depending on the container default the body may be raw PCM or WAV-wrapped;
  // strip the 44-byte RIFF header when present so chunks concatenate cleanly.
  if (buf.length > 44 && buf.toString('ascii', 0, 4) === 'RIFF') buf = buf.subarray(44);
  return buf;
}

async function deepgramVoiceover(trimmed, assetsDir) {
  const chunks = chunkText(trimmed);
  console.log(`[tts] Deepgram: ${chunks.length} chunk(s), voice=${DG_VOICE}`);

  const parts = [];
  for (const chunk of chunks) parts.push(await retry(() => deepgramSpeak(chunk)));

  const pcm      = Buffer.concat(parts);
  const filename = 'audio.wav';
  writeWav(path.join(assetsDir, filename), pcm, { sampleRate: DG_RATE, channels: 1, bitDepth: 16 });
  console.log(`[tts] Wrote audio.wav — ${(pcm.length / 1024).toFixed(1)} KB (deepgram)`);
  return filename;
}

export async function generateVoiceover({ text, assetsDir, voiceName = 'Charon' }) {
  const trimmed = text.slice(0, 9000).trim();
  console.log(`[tts] Generating voiceover — ${trimmed.length} chars, voice=${voiceName}`);

  try {
    if (process.env.DEEPGRAM_API_KEY) {
      return await deepgramVoiceover(trimmed, assetsDir);
    }

    const response = await retry(async () => {
      return await getAI().models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: trimmed }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } },
          },
        },
      });
    });

    // Log full response structure for debugging
    const candidate = response?.candidates?.[0];
    const part      = candidate?.content?.parts?.[0];
    console.log('[tts] Candidate keys:', candidate ? Object.keys(candidate) : 'none');
    console.log('[tts] Part keys:', part ? Object.keys(part) : 'none');
    console.log('[tts] inlineData mimeType:', part?.inlineData?.mimeType);
    console.log('[tts] inlineData data length:', part?.inlineData?.data?.length);

    const audioData = part?.inlineData?.data;
    if (!audioData) {
      // Try alternate path used by some SDK versions
      const altData = response?.candidates?.[0]?.content?.parts?.[0]?.blob?.data
                   || response?.result?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!altData) {
        console.error('[tts] Full response:', JSON.stringify(response).slice(0, 500));
        throw new Error('No audio data found in TTS response');
      }
      return writeAudio(altData, assetsDir);
    }

    return writeAudio(audioData, assetsDir);
  } catch (err) {
    console.error('[tts] Failed:', err.message);
    return null;
  }
}

function writeAudio(base64Data, assetsDir) {
  const pcmBuffer = Buffer.from(base64Data, 'base64');
  const filename  = 'audio.wav';
  writeWav(path.join(assetsDir, filename), pcmBuffer, { sampleRate: 24000, channels: 1, bitDepth: 16 });
  console.log(`[tts] Wrote audio.wav — ${(pcmBuffer.length / 1024).toFixed(1)} KB`);
  return filename;
}

function writeWav(filePath, pcmData, { sampleRate, channels, bitDepth }) {
  const dataSize   = pcmData.length;
  const buffer     = Buffer.alloc(44 + dataSize);
  const byteRate   = sampleRate * channels * (bitDepth / 8);
  const blockAlign = channels * (bitDepth / 8);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitDepth, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmData.copy(buffer, 44);

  fs.writeFileSync(filePath, buffer);
}

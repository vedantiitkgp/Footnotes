import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';

function getAI() {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

async function withRetry(fn, attempts = 2) {
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('RESOURCE_EXHAUSTED');
      if (is429 && i < attempts - 1) {
        const delay = (i + 1) * 10000;
        console.warn(`[tts] 429 — retrying in ${delay / 1000}s`);
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw err;
      }
    }
  }
}

export async function generateVoiceover({ text, assetsDir, voiceName = 'Charon' }) {
  const trimmed = text.slice(0, 4000).trim();
  console.log(`[tts] Generating voiceover — ${trimmed.length} chars, voice=${voiceName}`);

  try {
    const response = await withRetry(async () => {
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

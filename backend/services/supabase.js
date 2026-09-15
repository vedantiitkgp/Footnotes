import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;

export const supabaseEnabled = Boolean(url && key);

const supabase = supabaseEnabled
  ? createClient(url, key, { auth: { persistSession: false } })
  : null;

const BUCKET = 'memoirs';
const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.heic': 'image/heic',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
};

function mimeFor(name) {
  return MIME[path.extname(name).toLowerCase()] || 'application/octet-stream';
}

/** Upload a local file to <bucket>/<objectPath>. Overwrites if present. */
export async function uploadObject(objectPath, localPath) {
  const body = fs.readFileSync(localPath);
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, body, { contentType: mimeFor(objectPath), upsert: true });
  if (error) throw error;
  return objectPath;
}

export function publicUrl(objectPath) {
  return supabase.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

export async function saveMemoir(sessionId, data) {
  const { error } = await supabase
    .from('memoirs')
    .upsert({ session_id: sessionId, created_at: data.createdAt, data });
  if (error) throw error;
}

export async function listMemoirs() {
  const { data, error } = await supabase
    .from('memoirs')
    .select('session_id, created_at, data')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function getMemoir(sessionId) {
  const { data, error } = await supabase
    .from('memoirs')
    .select('data')
    .eq('session_id', sessionId)
    .maybeSingle();
  if (error) throw error;
  return data?.data || null;
}

export async function deleteMemoir(sessionId) {
  // Storage.list is not recursive — enumerate the two known subfolders.
  const paths = [];
  for (const sub of ['photos', 'assets']) {
    const { data: files } = await supabase.storage.from(BUCKET).list(`${sessionId}/${sub}`, { limit: 1000 });
    for (const f of files || []) paths.push(`${sessionId}/${sub}/${f.name}`);
  }
  if (paths.length) await supabase.storage.from(BUCKET).remove(paths);
  const { error } = await supabase.from('memoirs').delete().eq('session_id', sessionId);
  if (error) throw error;
}

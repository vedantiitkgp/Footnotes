/**
 * Copy a shareable link for the memoir to the clipboard.
 */
export async function copyShareLink(sessionId) {
  const url = `${window.location.origin}/memoir/${sessionId}`;
  try {
    await navigator.clipboard.writeText(url);
    return { success: true, url };
  } catch {
    // Fallback: prompt
    window.prompt('Copy this link:', url);
    return { success: false, url };
  }
}

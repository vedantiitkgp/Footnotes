import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

async function srcToDataURL(src) {
  const res = await fetch(src);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Export the memoir page as a multi-page PDF.
 * @param {HTMLElement} element - The container element to capture
 * @param {string} filename - Output filename (without extension)
 */
export async function exportToPDF(element, filename = 'memoir') {
  if (!element) throw new Error('No element provided for PDF export');

  console.log('[pdf] Starting export, element:', element.tagName, element.className);

  // Pre-fetch every <img> as a data URL so html2canvas never makes its own
  // cross-origin requests (which taint the canvas and break toDataURL).
  const imgs = Array.from(element.querySelectorAll('img[src]'));
  console.log('[pdf] Images found:', imgs.length);
  const restored = [];

  await Promise.all(imgs.map(async (img) => {
    const src = img.src;
    if (!src || src.startsWith('data:')) return;
    try {
      const dataUrl = await srcToDataURL(src);
      restored.push({ img, src });
      img.src = dataUrl;
    } catch (e) {
      console.warn('[pdf] Image pre-fetch failed:', src, e);
    }
  }));

  console.log('[pdf] Images pre-fetched, running html2canvas…');

  // Patch createPattern to silently handle zero-dimension canvases (Leaflet tiles
  // and other off-screen canvases that html2canvas tries to use as patterns).
  const origCreatePattern = CanvasRenderingContext2D.prototype.createPattern;
  CanvasRenderingContext2D.prototype.createPattern = function (image, repetition) {
    if (image instanceof HTMLCanvasElement && (image.width === 0 || image.height === 0)) {
      return null;
    }
    return origCreatePattern.call(this, image, repetition);
  };

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#0a0a0a',
      scale: 1.5,
      useCORS: false,
      allowTaint: false,
      logging: false,
      ignoreElements: (el) =>
        el.classList?.contains('route-map') ||
        el.classList?.contains('leaflet-container'),
    });

    console.log('[pdf] Canvas size:', canvas.width, 'x', canvas.height);

    const imgData   = canvas.toDataURL('image/jpeg', 0.92);
    console.log('[pdf] imgData length:', imgData.length);

    const pdfWidth  = 210; // A4 mm
    const ratio     = canvas.width / canvas.height;
    const pdfHeight = pdfWidth / ratio;

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageHeight = pdf.internal.pageSize.getHeight();
    let yOffset      = 0;

    while (yOffset < pdfHeight) {
      if (yOffset > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, -yOffset, pdfWidth, pdfHeight);
      yOffset += pageHeight;
    }

    console.log('[pdf] Saving…');
    pdf.save(`${filename}.pdf`);
    console.log('[pdf] Done.');
  } finally {
    // Restore patched createPattern and original image sources
    CanvasRenderingContext2D.prototype.createPattern = origCreatePattern;
    restored.forEach(({ img, src }) => { img.src = src; });
  }
}

import React, { useState } from 'react';
import { exportToPDF } from '../../utils/pdfExport.js';
import { copyShareLink } from '../../utils/shareLink.js';
import './ExportPanel.css';

export default function ExportPanel({ sessionId, memoirRef }) {
  const [pdfLoading, setPdfLoading]     = useState(false);
  const [copied, setCopied]             = useState(false);

  async function handlePDF() {
    const element = document.querySelector('.memoir-main');
    console.error('[pdf] handlePDF called, element:', element);
    if (!element) return;
    setPdfLoading(true);
    try {
      await exportToPDF(element, `memoir-${sessionId}`);
    } catch (err) {
      console.error('[pdf] export failed:', err);
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleShare() {
    await copyShareLink(sessionId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="export-panel">
      <button
        className="export-btn export-btn--primary"
        onClick={handlePDF}
        disabled={pdfLoading}
      >
        {pdfLoading ? (
          <span className="export-btn__spinner" />
        ) : (
          <>
            <span>↓</span> Download PDF
          </>
        )}
      </button>

      <button className="export-btn" onClick={handleShare}>
        {copied ? '✓ Copied!' : <><span>⊕</span> Share link</>}
      </button>
    </div>
  );
}

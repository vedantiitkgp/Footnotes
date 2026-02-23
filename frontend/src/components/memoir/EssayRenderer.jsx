import React, { useMemo } from 'react';
import PostcardCard from './PostcardCard.jsx';
import './EssayRenderer.css';

function parseEssay(text) {
  const lines    = text.split('\n');
  const chapters = [];
  let current    = null;

  for (const line of lines) {
    const match = line.match(/^##\s+(.+)/);
    if (match) {
      if (current) chapters.push(current);
      current = { title: match[1].trim(), paragraphs: [] };
    } else if (current) {
      const t = line.trim();
      if (t) current.paragraphs.push(t);
    } else {
      if (!current) current = { title: '', paragraphs: [] };
      const t = line.trim();
      if (t) current.paragraphs.push(t);
    }
  }
  if (current) chapters.push(current);
  return chapters;
}

const PULL_KEYWORDS = /dawn|night|silence|light|shadow|ancient|vast|wonder|lost|found|sky|sea|heart|breath|dust|memory|horizon/i;

function extractPullQuote(para) {
  const sentences = para.split(/(?<=[.!?])\s+/);
  return sentences.find((s) => s.length > 65 && PULL_KEYWORDS.test(s)) || null;
}

export default function EssayRenderer({ essay, postcards = [], photoFiles = [], sessionId, locations = [] }) {
  const chapters = useMemo(() => parseEssay(essay), [essay]);

  // Build interleaved image list (postcards take priority, then photos)
  const allImages = [
    ...postcards.map((p) => ({ type: 'postcard', url: p.url, index: p.index })),
    ...photoFiles.slice(0, 6).map((f, i) => ({
      type: 'photo',
      url: `/api/assets/${sessionId}/${f}`,
      index: i,
    })),
  ];

  function getImageForChapter(ci) {
    return allImages[ci % allImages.length] || null;
  }

  // Pick location for a postcard: cycle through detected locations
  function getLocation(postcardIndex) {
    if (!locations.length) return 'the journey';
    return locations[postcardIndex % locations.length];
  }

  if (!essay) {
    return (
      <div className="essay-streaming">
        <span className="essay-streaming__cursor">|</span>
      </div>
    );
  }

  return (
    <div className="essay-renderer">
      {chapters.map((chapter, ci) => {
        const image        = getImageForChapter(ci);
        const pullQuoteIdx = chapter.paragraphs.findIndex((p) => extractPullQuote(p) !== null);

        return (
          <section key={ci} className="essay-chapter">
            {chapter.title && (
              <div className="essay-chapter__header">
                <span className="essay-chapter__number">
                  {String(ci + 1).padStart(2, '0')}
                </span>
                <h2 className="essay-chapter__title">{chapter.title}</h2>
              </div>
            )}

            {chapter.paragraphs.map((para, pi) => {
              const pullQuote = extractPullQuote(para);
              const showPull  = pi === pullQuoteIdx && pullQuote;
              return (
                <React.Fragment key={pi}>
                  {showPull && (
                    <blockquote className="essay-pullquote">
                      <span className="essay-pullquote__mark">"</span>
                      {pullQuote}
                    </blockquote>
                  )}
                  <p className="essay-paragraph">{para}</p>
                </React.Fragment>
              );
            })}

            {/* After each chapter (except last): image or postcard */}
            {image && ci < chapters.length - 1 && (
              image.type === 'postcard' ? (
                <PostcardCard
                  url={image.url}
                  index={image.index}
                  location={getLocation(image.index)}
                />
              ) : (
                <div className="essay-image">
                  <img src={image.url} alt={`Travel photo ${image.index + 1}`} loading="lazy" />
                </div>
              )
            )}

            {ci < chapters.length - 1 && <hr className="gold-divider" />}
          </section>
        );
      })}
    </div>
  );
}

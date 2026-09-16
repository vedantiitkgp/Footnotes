import React, { useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
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

// MUST match the cap in backend/services/ttsService.js (text.slice(0, 9000)).
// The highlight position is derived from it, so if the two disagree the
// highlight drifts out of sync with the voice for the whole playback.
const TTS_CHAR_CAP = 9000;

const PULL_KEYWORDS = /dawn|night|silence|light|shadow|ancient|vast|wonder|lost|found|sky|sea|heart|breath|dust|memory|horizon/i;

function extractPullQuote(para) {
  const sentences = para.split(/(?<=[.!?])\s+/);
  return sentences.find((s) => s.length > 65 && PULL_KEYWORDS.test(s)) || null;
}

const EssayRenderer = forwardRef(function EssayRenderer(
  { essay, postcards = [], photoFiles = [], sessionId, locations = [] },
  ref,
) {
  const rendererRef    = useRef(null);
  const prevWordRef    = useRef(-1);
  const prevParaRef    = useRef(-1);

  // Pre-compute chapters with global word + paragraph indices
  // Title words are indexed too so the highlight passes through headings smoothly
  const { chapters, totalWords, spokenWords } = useMemo(() => {
    const raw = parseEssay(essay);
    let gParaIdx = 0;
    let gWordIdx = 0;

    const chapters = raw.map((chapter) => {
      // Index heading words so highlight doesn't skip them
      let titleParaIdx = null;
      let titleWordsWithIndex = [];
      if (chapter.title) {
        titleParaIdx = gParaIdx++;
        titleWordsWithIndex = chapter.title.split(/\s+/).filter(Boolean)
          .map((word) => ({ word, wi: gWordIdx++ }));
      }

      const paragraphs = chapter.paragraphs.map((para) => {
        const paraIdx = gParaIdx++;
        const words   = para.split(/\s+/).filter(Boolean);
        const wordsWithIndex = words.map((word) => ({ word, wi: gWordIdx++ }));
        return { paraIdx, wordsWithIndex, raw: para };
      });

      return { title: chapter.title, titleParaIdx, titleWordsWithIndex, paragraphs };
    });

    const totalWords  = gWordIdx;
    // How many words the voiceover actually covers — see TTS_CHAR_CAP above.
    // For an essay shorter than the cap this equals totalWords, which is the
    // usual case (essays are 700-1000 words).
    const spokenWords = essay.slice(0, TTS_CHAR_CAP).split(/\s+/).filter(Boolean).length;
    return { chapters, totalWords, spokenWords };
  }, [essay]);

  // Expose imperative API so MemoirPage can drive highlighting without prop re-renders
  useImperativeHandle(ref, () => ({
    highlight(audioTime, audioDuration) {
      if (!audioDuration || !rendererRef.current || totalWords === 0) return;

      const wordIdx = Math.min(
        Math.floor((audioTime / audioDuration) * spokenWords),
        totalWords - 1,
      );
      if (wordIdx < 0 || wordIdx === prevWordRef.current) return;

      const container = rendererRef.current;

      // Swap word highlight
      if (prevWordRef.current >= 0) {
        container.querySelector(`[data-wi="${prevWordRef.current}"]`)
          ?.classList.remove('word--active');
      }
      const wordEl = container.querySelector(`[data-wi="${wordIdx}"]`);
      wordEl?.classList.add('word--active');
      prevWordRef.current = wordIdx;

      // Swap paragraph highlight + maybe scroll
      const paraEl = wordEl?.closest('[data-pi]');
      if (paraEl) {
        const pIdx = Number(paraEl.dataset.pi);
        if (pIdx !== prevParaRef.current) {
          if (prevParaRef.current >= 0) {
            container.querySelector(`[data-pi="${prevParaRef.current}"]`)
              ?.classList.remove('para--active');
          }
          paraEl.classList.add('para--active');
          prevParaRef.current = pIdx;

          // Scroll only if paragraph is outside the visible area
          const rect = paraEl.getBoundingClientRect();
          if (rect.top < 80 || rect.bottom > window.innerHeight - 80) {
            paraEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    },

    reset() {
      const container = rendererRef.current;
      if (!container) return;
      if (prevWordRef.current >= 0) {
        container.querySelector(`[data-wi="${prevWordRef.current}"]`)
          ?.classList.remove('word--active');
        prevWordRef.current = -1;
      }
      if (prevParaRef.current >= 0) {
        container.querySelector(`[data-pi="${prevParaRef.current}"]`)
          ?.classList.remove('para--active');
        prevParaRef.current = -1;
      }
    },
  }), [spokenWords, totalWords]);

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
    <div className="essay-renderer" ref={rendererRef}>
      {chapters.map((chapter, ci) => {
        const image        = getImageForChapter(ci);
        const pullQuoteIdx = chapter.paragraphs.findIndex(
          ({ raw }) => extractPullQuote(raw) !== null,
        );

        return (
          <section key={ci} className="essay-chapter">
            {chapter.title && (
              <div className="essay-chapter__header">
                <span className="essay-chapter__number">
                  {String(ci + 1).padStart(2, '0')}
                </span>
                <h2 className="essay-chapter__title" data-pi={chapter.titleParaIdx}>
                  {chapter.titleWordsWithIndex.map(({ word, wi }) => (
                    <span key={wi} data-wi={wi}>{word}{' '}</span>
                  ))}
                </h2>
              </div>
            )}

            {chapter.paragraphs.map(({ paraIdx, wordsWithIndex, raw }, pi) => {
              const pullQuote = extractPullQuote(raw);
              const showPull  = pi === pullQuoteIdx && pullQuote;
              return (
                <React.Fragment key={paraIdx}>
                  {showPull && (
                    <blockquote className="essay-pullquote">
                      <span className="essay-pullquote__mark">"</span>
                      {pullQuote}
                    </blockquote>
                  )}
                  <p className="essay-paragraph" data-pi={paraIdx}>
                    {wordsWithIndex.map(({ word, wi }) => (
                      <span key={wi} data-wi={wi}>{word}{' '}</span>
                    ))}
                  </p>
                </React.Fragment>
              );
            })}

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
});

export default EssayRenderer;

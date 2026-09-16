// Writes a list of texts to the clipboard one after another, a pause between
// each, so Windows clipboard history (Win+V) keeps every one. The history is
// a background listener that reads the clipboard some time after each change
// notification; a write that lands before it gets to the previous one is
// skipped. At 80 ms the desk saw one or two of eight survive (owner
// 2026-09-16), so the gap is a generous fraction of a second. Kept off React
// so the sequencing is testable under node.

export const CLIP_GAP_MS = 400;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export const writeSequence = async (texts, { write, wait = sleep, gapMs = CLIP_GAP_MS, onProgress } = {}) => {
  for (let i = 0; i < texts.length; i++) {
    if (i) await wait(gapMs);
    onProgress?.(i + 1, texts.length);
    await write(texts[i]);
  }
};

/**
 * Parse an AI storyboard/text post into carousel slide bodies.
 * Handles "Slide N: ..." storyboards and plain paragraph content.
 */

const MAX_SLIDES = 7;

function cleanSlide(raw: string): string {
  return raw
    .replace(/^Slide\s*\d+\s*[:.\-–—]\s*/i, "")
    .replace(/^["'\u2018-]+|["'\u2019-]+$/g, "")
    .replace(/\s*(with timer graphics|with icons|placeholder[.:]?|visual concept:)/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split content on "Slide N:" markers, even when the storyboard is one long line. */
function splitOnSlideMarkers(text: string): string[] {
  const parts = text.split(/(?=Slide\s*\d+\s*[:.\-–—])/i).map((p) => p.trim()).filter(Boolean);
  return parts;
}

export function parseSlides(hook: string, content: string, caption: string): { slides: string[]; cta: string } {
  const ctaMatch = caption.match(/CTA[:\s]*([^\n.]+[.!?]?)/i);
  const cta = (ctaMatch ? ctaMatch[1] : "Try free today").replace(/#.*/g, "").trim() || "Try free today";

  const marked = splitOnSlideMarkers(content)
    .filter((l) => /^Slide\s*\d+/i.test(l))
    .map(cleanSlide)
    .filter(Boolean)
    .slice(0, MAX_SLIDES);

  let slides = [...marked];

  if (slides.length === 0) {
    const chunks = content
      .split(/\n\n+/)
      .map((c) => c.replace(/\n/g, " ").trim())
      .filter(Boolean)
      .slice(0, MAX_SLIDES - 2);
    slides = chunks;
  }

  const out: string[] = [hook.replace(/\s+/g, " ").trim()];
  for (const s of slides) out.push(s);
  while (out.length < 2) out.push(content.replace(/\s+/g, " ").trim());
  return { slides: out, cta: `${cta} →` };
}

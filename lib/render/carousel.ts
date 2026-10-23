/**
 * Carousel image renderer: turns post text into branded PNG slides (1080x1350)
 * using sharp. No external AI/design service — deterministic, free.
 * Fonts: system Arial (available on Windows/macOS servers).
 */
import { parseSlides } from "./parse";

export interface CarouselInput {
  id: string;
  hook: string;
  content: string;
  caption: string;
  brand?: string;
}

export interface RenderedSlide {
  index: number;
  svg: Buffer;
}

const W = 1080;
const H = 1350;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

/** Word-wrap to lines that fit in widthPx at fontSize (approx 0.52 * fontSize per char in Arial bold). */
function wrap(text: string, fontPx: number, maxWidthPx = W - 160): string[] {
  const charW = fontPx * 0.54;
  const maxChars = Math.max(8, Math.floor(maxWidthPx / charW));
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (t.length <= maxChars) line = t;
    else {
      if (line) lines.push(line);
      line = w.length > maxChars ? w.slice(0, maxChars - 1) + "-" : w;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 12);
}

/** Shrink font until the text fits the line budget. */
function fitText(text: string, basePx: number, minPx: number, maxLines: number): { lines: string[]; size: number } {
  for (let size = basePx; size >= minPx; size -= 6) {
    const lines = wrap(text, size);
    if (lines.length <= maxLines) return { lines, size };
  }
  return { lines: wrap(text, minPx).slice(0, maxLines), size: minPx };
}

function slideSvg(text: string, accent: string, brand: string, index: number, total: number): Buffer {
  const { lines, size } = fitText(text, 84, 44, 9);
  const lineH = Math.round(size * 1.3);
  const blockH = lines.length * lineH;
  const firstBaseline = Math.round((H - blockH) / 2 + size * 0.85);
  const tspans = lines
    .map((l, i) => `<tspan x="80" dy="${i === 0 ? 0 : lineH}">${esc(l)}</tspan>`)
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/><stop offset="55%" stop-color="#132043"/><stop offset="100%" stop-color="#1e1b4b"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="${(W * 0.82).toFixed(0)}" cy="${(H * 0.18).toFixed(0)}" r="220" fill="${accent}" opacity="0.14"/>
  <circle cx="${(W * 0.12).toFixed(0)}" cy="${(H * 0.86).toFixed(0)}" r="260" fill="${accent}" opacity="0.10"/>
  <rect x="80" y="150" width="72" height="10" rx="5" fill="${accent}"/>
  <text x="80" y="${(firstBaseline - size - 44).toFixed(0)}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" letter-spacing="6" fill="#8ea2ff">${esc(brand.toUpperCase() || "AUTO · MARKETING")}</text>
  <text x="80" y="${firstBaseline}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="800" fill="#f8fafc">
    ${tspans}
  </text>
  <text x="80" y="${H - 90}" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#94a3b8">${index + 1} / ${total}</text>
  <text x="${W - 80}" y="${H - 90}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#e2e8f0" opacity="0.9">→</text>
</svg>`.replace(/\n\s*/g, "\n");
  return Buffer.from(svg, "utf8");
}

export function renderCarousel(input: CarouselInput, colors?: string[]): RenderedSlide[] {
  const { slides, cta } = parseSlides(input.hook, input.content, input.caption);
  const palette = ["#5b6cff", "#7c3aed", "#0ea5e9"];
  const accentFor = (i: number): string => (colors && colors[i % colors.length]) || palette[i % palette.length];
  const brand = input.brand || "";
  const out: RenderedSlide[] = [];
  for (let i = 0; i < slides.length; i++) out.push({ index: i, svg: slideSvg(slides[i], accentFor(i), brand, i, slides.length) });
  out.push({ index: slides.length, svg: slideSvg(cta, "#fbbf24", brand, slides.length, slides.length + 1) });
  return out;
}

// מטמון ציורי נוסחאות: כל נוסחה הופכת פעם אחת לתמונה חדה, ונשמרת לשימוש חוזר.
// MathJax נטען רק בפעם הראשונה שצריך אותו.

type MathJaxModule = typeof import('../../features/math/mathjax');

let loading: Promise<MathJaxModule> | null = null;
function loadMathJax(): Promise<MathJaxModule> {
  loading ??= import('../../features/math/mathjax');
  return loading;
}

interface Entry {
  img: HTMLImageElement | null;
  widthEm: number;
  heightEm: number;
  promise: Promise<void>;
}

const cache = new Map<string, Entry>();
const listeners = new Set<() => void>();

/** רזולוציה פנימית: פי 4 מהגודל הבסיסי, כדי שהנוסחה תישאר חדה גם בזום */
const RASTER = 4;

function key(latex: string, color: string) {
  return `${color}|${latex}`;
}

async function render(latex: string, color: string, entry: Entry, basePx: number) {
  const mj = await loadMathJax();
  const out = mj.texToSvg(latex);
  entry.widthEm = out.widthEm;
  entry.heightEm = out.heightEm;
  const w = Math.max(1, Math.round(out.widthEm * basePx * RASTER));
  const h = Math.max(1, Math.round(out.heightEm * basePx * RASTER));
  const svg = out.svg
    .replace(/currentColor/g, color)
    .replace(/width="[^"]*"/, `width="${w}"`)
    .replace(/height="[^"]*"/, `height="${h}"`);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const img = new Image();
  img.src = url;
  try {
    await img.decode();
    entry.img = img;
  } finally {
    URL.revokeObjectURL(url);
  }
  for (const l of listeners) l();
}

function ensureEntry(latex: string, color: string, basePx: number): Entry {
  const k = key(latex, color);
  let e = cache.get(k);
  if (!e) {
    e = { img: null, widthEm: 0, heightEm: 0, promise: Promise.resolve() };
    e.promise = render(latex, color, e, basePx).catch(() => undefined);
    cache.set(k, e);
  }
  return e;
}

/** תמונת הנוסחה אם מוכנה (ואם לא – מתחיל להכין ומודיע כשמוכן) */
export function getMathImage(latex: string, color: string): HTMLImageElement | null {
  return ensureEntry(latex, color, 48).img;
}

/** מחכה שכל הנוסחאות יהיו מוכנות (לפני ייצוא) */
export async function ensureMathImages(items: { latex: string; color: string }[]): Promise<void> {
  await Promise.all(items.map((i) => ensureEntry(i.latex, i.color, 48).promise));
}

/** מודד נוסחה (בפיקסלים, לפי גודל אות) – לפני יצירת אובייקט */
export async function measureMath(
  latex: string,
  fontSize: number,
): Promise<{ width: number; height: number }> {
  const mj = await loadMathJax();
  const out = mj.texToSvg(latex);
  return { width: out.widthEm * fontSize, height: out.heightEm * fontSize };
}

export function onMathReady(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

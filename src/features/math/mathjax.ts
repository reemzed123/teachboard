// המרת LaTeX לציור SVG בעזרת MathJax – בלי אינטרנט ובלי קובצי גופנים
// (פלט SVG שבו כל תו הוא צורה). נטען רק כשצריך (קובץ נפרד).
import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import 'mathjax-full/js/input/tex/base/BaseConfiguration.js';
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js';
import 'mathjax-full/js/input/tex/newcommand/NewcommandConfiguration.js';
import 'mathjax-full/js/input/tex/noundefined/NoUndefinedConfiguration.js';

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

// בלי חבילות שטוענות קבצים מהרשת (require/autoload) ובלי html/href
const doc = mathjax.document('', {
  InputJax: new TeX({ packages: ['base', 'ams', 'newcommand', 'noundefined'] }),
  OutputJax: new SVG({ fontCache: 'none' }),
});

export interface MathSvg {
  /** קוד ה-SVG (עם currentColor לצבע) */
  svg: string;
  /** רוחב וגובה ביחידות em (גודל אות) */
  widthEm: number;
  heightEm: number;
}

export function texToSvg(latex: string): MathSvg {
  const node = doc.convert(latex, { display: true });
  const svg = adaptor.innerHTML(node);
  const vb = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
  const w = vb ? Number(vb[3]) / 1000 : 1;
  const h = vb ? Number(vb[4]) / 1000 : 1;
  return { svg, widthEm: w, heightEm: h };
}

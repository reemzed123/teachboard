// מעתיק לתוך התוכנה קבצים שספריות צריכות בזמן ריצה, כדי שיעבדו בלי אינטרנט:
// - גופני עורך הנוסחאות (MathLive)
// - קובצי העזר של מציג ה-PDF (PDF.js): גופנים סטנדרטיים, טבלאות תווים ופענוח תמונות.
//   (quickjs-eval – מנוע להרצת קוד מתוך PDF – לא מועתק בכוונה: לא מריצים קוד מקבצים.)
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';

function copy(from, to, keep) {
  rmSync(to, { recursive: true, force: true });
  mkdirSync(to, { recursive: true });
  let n = 0;
  for (const f of readdirSync(from)) {
    if (keep(f)) {
      cpSync(`${from}/${f}`, `${to}/${f}`);
      n++;
    }
  }
  console.log(`${from} → ${to} (${n})`);
}

copy('node_modules/mathlive/fonts', 'public/mathlive/fonts', (f) => f.endsWith('.woff2'));
const pdf = 'node_modules/pdfjs-dist';
copy(`${pdf}/standard_fonts`, 'public/pdfjs/standard_fonts', (f) =>
  /\.(pfb|ttf)$|^LICENSE/.test(f),
);
copy(`${pdf}/cmaps`, 'public/pdfjs/cmaps', (f) => f.endsWith('.bcmap') || f === 'LICENSE');
copy(`${pdf}/iccs`, 'public/pdfjs/iccs', (f) => f.endsWith('.icc') || f === 'LICENSE');
copy(
  `${pdf}/wasm`,
  'public/pdfjs/wasm',
  (f) => ['jbig2.wasm', 'openjpeg.wasm', 'qcms_bg.wasm'].includes(f) || f.startsWith('LICENSE'),
);

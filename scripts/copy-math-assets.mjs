// מעתיק את הגופנים של עורך הנוסחאות (MathLive) לתוך התוכנה, כדי שיעבדו בלי אינטרנט.
import { cpSync, mkdirSync, readdirSync } from 'node:fs';

const from = 'node_modules/mathlive/fonts';
const to = 'public/mathlive/fonts';
mkdirSync(to, { recursive: true });
for (const f of readdirSync(from)) if (f.endsWith('.woff2')) cpSync(`${from}/${f}`, `${to}/${f}`);
console.log(`MathLive fonts → ${to}`);

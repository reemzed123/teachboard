// בודק שכל הספריות שנכנסות לתוכנה המופצת (dependencies) הן ברישיון
// שמתיר שימוש והפצה בתוכנה בקוד סגור. רישיון שאינו ברשימה – הבדיקה נכשלת.
import { execSync } from 'node:child_process';

const ALLOWED = new Set([
  'MIT',
  'Apache-2.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'ISC',
  '0BSD',
  'Unlicense',
  'CC0-1.0',
  'OFL-1.1',
  'BlueOak-1.0.0',
  'Zlib',
  // ספריות ברישיון כפול: מותר כי ניתן לבחור באחת האפשרויות המתירניות.
  '(MIT OR LGPL-3.0-or-later)',
  'Apache-2.0 OR MIT',
  'MIT OR Apache-2.0',
  // שני רישיונות מתירניים יחד (pako, תלות של pdf-lib).
  '(MIT AND Zlib)',
]);

const raw = execSync('pnpm licenses list --prod --json', { encoding: 'utf8' });
const byLicense = JSON.parse(raw);
const problems = [];
let count = 0;
for (const [license, pkgs] of Object.entries(byLicense)) {
  for (const pkg of pkgs) {
    count++;
    if (!ALLOWED.has(license)) problems.push(`${pkg.name}@${pkg.versions.join(',')}: ${license}`);
  }
}

if (problems.length) {
  console.error('ספריות ברישיון שלא אושר:\n' + problems.join('\n'));
  process.exit(1);
}
console.log(`בדיקת רישיונות עברה: ${count} ספריות, כולן ברישיון מאושר.`);

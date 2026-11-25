let counter = 0;

/** מזהה ייחודי לאובייקט. ייחודי גם בין חלונות וגם אחרי טעינה מקובץ. */
export function newId(prefix = 'o'): string {
  counter = (counter + 1) % 0xffffff;
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${rand}`;
}

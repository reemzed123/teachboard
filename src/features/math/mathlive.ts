// טעינת עורך הנוסחאות (MathLive) – רק כשצריך, ובלי שום פנייה לאינטרנט:
// גופנים מקומיים, בלי צלילים, ובלי מנוע חישוב חיצוני.

let loading: Promise<typeof import('mathlive')> | null = null;

export function loadMathLive() {
  loading ??= import('mathlive').then((ml) => {
    ml.MathfieldElement.fontsDirectory = new URL('mathlive/fonts/', document.baseURI).href;
    ml.MathfieldElement.soundsDirectory = null;
    ml.MathfieldElement.keypressSound = null;
    ml.MathfieldElement.plonkSound = null;
    ml.MathfieldElement.computeEngine = null;
    return ml;
  });
  return loading;
}

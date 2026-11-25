// שמירה ופתיחה של קבצים בדפדפן.
// ב-Chrome/Edge: חלון "שמירה בשם" אמיתי של Windows. אחרת – הורדה רגילה.

interface FileKind {
  description: string;
  mime: string;
  extension: string;
}

type SavePicker = (opts: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<{
  createWritable(): Promise<{ write(b: Blob): Promise<void>; close(): Promise<void> }>;
}>;

/** שמות קבצים: מסירים תווים שאסורים ב-Windows. */
export function safeFileName(name: string): string {
  const cleaned = [...name]
    .map((ch) => (ch.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(ch) ? ' ' : ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  return (cleaned || 'TeachBoard').slice(0, 120);
}

/** מחזיר false אם המשתמש ביטל. */
export async function saveFile(blob: Blob, baseName: string, kind: FileKind): Promise<boolean> {
  const suggestedName = `${safeFileName(baseName)}${kind.extension}`;
  const picker = (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker;
  if (picker) {
    try {
      const handle = await picker({
        suggestedName,
        types: [{ description: kind.description, accept: { [kind.mime]: [kind.extension] } }],
      });
      const w = await handle.createWritable();
      await w.write(blob);
      await w.close();
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return false;
      // חלון השמירה לא זמין כאן (למשל בתוך מסגרת) – ממשיכים להורדה רגילה.
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return true;
}

/** פותח חלון בחירת קובץ. מחזיר null אם בוטל. */
export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      resolve(input.files?.[0] ?? null);
      input.remove();
    });
    input.addEventListener('cancel', () => {
      resolve(null);
      input.remove();
    });
    document.body.append(input);
    input.click();
  });
}

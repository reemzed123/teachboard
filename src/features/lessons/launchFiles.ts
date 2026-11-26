import type { AppRuntime } from '../../app/runtime';
import { importPdf, openBoardFile } from './fileActions';

// כשהתוכנה מותקנת, Windows יכול לפתוח בה קובצי ‎.board ו-PDF (לחיצה כפולה / "פתח באמצעות").
// הקבצים מגיעים דרך launchQueue; כל קובץ נבדק כרגיל (כמו פתיחה מתוך התוכנה).

interface LaunchParams {
  files: { kind: string; getFile(): Promise<File> }[];
}

export function handleLaunchedFiles(rt: AppRuntime): void {
  const queue = (
    window as unknown as {
      launchQueue?: { setConsumer(cb: (p: LaunchParams) => void): void };
    }
  ).launchQueue;
  if (!queue) return;
  queue.setConsumer((params) => {
    void (async () => {
      // מחכים שהשיעור האחרון ייטען, כדי שהקובץ ייפתח אחריו (ולא יידרס)
      if (rt.lessons.getState().status === 'loading') {
        await new Promise<void>((resolve) => {
          const unsub = rt.lessons.subscribe((s) => {
            if (s.status !== 'loading') {
              unsub();
              resolve();
            }
          });
        });
      }
      for (const handle of params.files ?? []) {
        if (handle.kind !== 'file') continue;
        const file = await handle.getFile();
        if (/\.pdf$/i.test(file.name)) await importPdf(rt, 'new', file);
        else await openBoardFile(rt, file);
      }
    })();
  });
}

import type { AppRuntime } from '../../app/runtime';
import { isDesktopApp } from '../../platform/desktop';
import { importPdf, openBoardFile } from './fileActions';

// כשהתוכנה מותקנת, Windows יכול לפתוח בה קובצי ‎.board ו-PDF (לחיצה כפולה / "פתח באמצעות").
// הקבצים מגיעים דרך launchQueue; כל קובץ נבדק כרגיל (כמו פתיחה מתוך התוכנה).

interface LaunchParams {
  files: { kind: string; getFile(): Promise<File> }[];
}

async function waitForLesson(rt: AppRuntime) {
  if (rt.lessons.getState().status !== 'loading') return;
  await new Promise<void>((resolve) => {
    const unsub = rt.lessons.subscribe((s) => {
      if (s.status !== 'loading') {
        unsub();
        resolve();
      }
    });
  });
}

/** תוכנת Windows: קובץ ‎.board שאיתו הופעלה התוכנה (לחיצה כפולה על קובץ) */
async function openDesktopLaunchFile(rt: AppRuntime) {
  const { invoke } = await import('@tauri-apps/api/core');
  const name = await invoke<string | null>('launch_file_name');
  if (!name) return;
  const bytes = await invoke<ArrayBuffer>('launch_file_bytes');
  await waitForLesson(rt);
  await openBoardFile(rt, new File([bytes], name, { type: 'application/x-teachboard' }));
}

export function handleLaunchedFiles(rt: AppRuntime): void {
  if (isDesktopApp()) {
    void openDesktopLaunchFile(rt).catch(() => undefined);
    return;
  }
  const queue = (
    window as unknown as {
      launchQueue?: { setConsumer(cb: (p: LaunchParams) => void): void };
    }
  ).launchQueue;
  if (!queue) return;
  queue.setConsumer((params) => {
    void (async () => {
      // מחכים שהשיעור האחרון ייטען, כדי שהקובץ ייפתח אחריו (ולא יידרס)
      await waitForLesson(rt);
      for (const handle of params.files ?? []) {
        if (handle.kind !== 'file') continue;
        const file = await handle.getFile();
        if (/\.pdf$/i.test(file.name)) await importPdf(rt, 'new', file);
        else await openBoardFile(rt, file);
      }
    })();
  });
}

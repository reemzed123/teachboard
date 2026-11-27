import { isDesktopApp } from '../../platform/desktop';

// פתיחת מסך המקרן: בתוכנת Windows – חלון במסך השני (אם יש), במסך מלא.
// בדפדפן – חלון חדש; גוררים אותו למקרן ולוחצים "מסך מלא".

let webWindow: Window | null = null;

export async function openProjector(): Promise<'opened' | 'blocked'> {
  const url = `${location.pathname}?view=projector`;
  if (isDesktopApp()) {
    const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
    const { availableMonitors, currentMonitor } = await import('@tauri-apps/api/window');
    const existing = await WebviewWindow.getByLabel('projector');
    if (existing) {
      await existing.setFocus();
      return 'opened';
    }
    const monitors = await availableMonitors();
    const here = await currentMonitor();
    const other = monitors.find((m) => m.name !== here?.name) ?? here;
    const pos = other ? other.position.toLogical(other.scaleFactor) : { x: 0, y: 0 };
    new WebviewWindow('projector', {
      url: 'index.html?view=projector',
      title: 'TeachBoard – מקרן',
      x: pos.x + 40,
      y: pos.y + 40,
      width: 1280,
      height: 800,
      fullscreen: !!other && other.name !== here?.name,
      focus: false,
    });
    return 'opened';
  }
  if (webWindow && !webWindow.closed) {
    webWindow.focus();
    return 'opened';
  }
  webWindow = window.open(url, 'teachboard-projector', 'popup,width=1280,height=800');
  return webWindow ? 'opened' : 'blocked';
}

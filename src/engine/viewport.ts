import type { Point, Rect } from '../core/geometry/rect';
import { ZOOM_LIMITS, type ViewState } from '../features/board/boardStore';

// המרה בין קואורדינטות מסך (פיקסלים בחלון) לקואורדינטות לוח.

export function screenToBoard(view: ViewState, sx: number, sy: number): Point {
  return { x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale };
}

export function boardToScreen(view: ViewState, bx: number, by: number): Point {
  return { x: bx * view.scale + view.x, y: by * view.scale + view.y };
}

export function clampScale(scale: number): number {
  return Math.min(ZOOM_LIMITS.max, Math.max(ZOOM_LIMITS.min, scale));
}

/** זום סביב נקודה במסך, כך שהנקודה שמתחת לעכבר/אצבעות נשארת במקומה. */
export function zoomAt(view: ViewState, sx: number, sy: number, newScale: number): ViewState {
  const scale = clampScale(newScale);
  const b = screenToBoard(view, sx, sy);
  return { scale, x: sx - b.x * scale, y: sy - b.y * scale };
}

/** האזור הנראה במסך, בקואורדינטות לוח. */
export function visibleBoardRect(view: ViewState, width: number, height: number): Rect {
  const a = screenToBoard(view, 0, 0);
  return { x: a.x, y: a.y, width: width / view.scale, height: height / view.scale };
}

/** תצוגה שמכניסה את המלבן למסך, עם שוליים. */
export function fitRect(rect: Rect, width: number, height: number, padding = 40): ViewState {
  const w = Math.max(rect.width, 1);
  const h = Math.max(rect.height, 1);
  const scale = clampScale(Math.min((width - padding * 2) / w, (height - padding * 2) / h, 2));
  return {
    scale,
    x: width / 2 - (rect.x + w / 2) * scale,
    y: height / 2 - (rect.y + h / 2) * scale,
  };
}

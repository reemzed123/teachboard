import type { BoardState, BoardStore, ViewState } from '../../features/board/boardStore';
import type { ObjectLayer } from '../render/ObjectLayer';
import type { LiveCanvas } from '../render/LiveCanvas';

/** נקודת קלט אחת (עכבר, עט או מגע) בקואורדינטות מסך ולוח. */
export interface InputPoint {
  sx: number;
  sy: number;
  bx: number;
  by: number;
  /** 0–1. כשאין מידע לחץ: 0.5 */
  pressure: number;
  pointerType: string;
  /** זמן האירוע במילישניות */
  t: number;
}

export interface PointerSample {
  point: InputPoint;
  /** כל הנקודות שנאספו מאז האירוע הקודם (קלט עט מדויק יותר) */
  coalesced: InputPoint[];
  shiftKey: boolean;
}

export interface ToolContext {
  store: BoardStore;
  state(): BoardState;
  view(): ViewState;
  objects: ObjectLayer;
  /** סמן עכבר זמני (למשל מעל ידית); null = הסמן הרגיל של הכלי */
  setCursor(cursor: string | null): void;
  live: LiveCanvas;
  requestOverlay(): void;
}

export interface ToolHandler {
  down(s: PointerSample): void;
  move(s: PointerSample): void;
  up(s: PointerSample): void;
  /** הפעולה בוטלה (למשל מחוות שתי אצבעות התחילה) */
  cancel(): void;
  /** ציור עזר על שכבת העזר (סמן מחק, מלבן בחירה) */
  drawOverlay?(ctx: CanvasRenderingContext2D, view: ViewState): void;
  hover?(p: InputPoint | null): void;
  /** המשטח החי נמחק (שינוי גודל) – מציירים מחדש את מה שבתהליך */
  redrawLive?(): void;
}

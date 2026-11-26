// טיימר ושעון עצר – חישוב טהור לפי זמנים (לא תלוי בקצב העדכון של המסך).

export type ClockMode = 'timer' | 'stopwatch';

export interface ClockState {
  mode: ClockMode;
  /** משך הטיימר (מילישניות); בשעון עצר לא בשימוש */
  durationMs: number;
  /** זמן שנצבר לפני ההפעלה הנוכחית */
  accumulatedMs: number;
  /** מתי הופעל (performance/Date ms), או null כשעצור */
  startedAt: number | null;
}

export const MAX_TIMER_MS = 24 * 60 * 60 * 1000;

export function newClock(mode: ClockMode, durationMs = 5 * 60 * 1000): ClockState {
  return { mode, durationMs: clampDuration(durationMs), accumulatedMs: 0, startedAt: null };
}

export function clampDuration(ms: number): number {
  if (!Number.isFinite(ms)) return 60_000;
  return Math.min(MAX_TIMER_MS, Math.max(1000, Math.round(ms / 1000) * 1000));
}

/** הזמן שעבר (מילישניות) */
export function elapsed(c: ClockState, now: number): number {
  return c.accumulatedMs + (c.startedAt === null ? 0 : Math.max(0, now - c.startedAt));
}

/** בטיימר: הזמן שנשאר (לא פחות מ-0); בשעון עצר: הזמן שעבר */
export function displayMs(c: ClockState, now: number): number {
  const e = elapsed(c, now);
  return c.mode === 'timer' ? Math.max(0, c.durationMs - e) : e;
}

export function isFinished(c: ClockState, now: number): boolean {
  return c.mode === 'timer' && elapsed(c, now) >= c.durationMs;
}

export function start(c: ClockState, now: number): ClockState {
  if (c.startedAt !== null || isFinished(c, now)) return c;
  return { ...c, startedAt: now };
}

export function pause(c: ClockState, now: number): ClockState {
  if (c.startedAt === null) return c;
  return { ...c, accumulatedMs: elapsed(c, now), startedAt: null };
}

export function reset(c: ClockState): ClockState {
  return { ...c, accumulatedMs: 0, startedAt: null };
}

/** תצוגה: 4:05, ‏12:00, או 1:02:03 – ועוגלים כלפי מעלה בטיימר (כמו שעון אמיתי) */
export function formatClock(ms: number, mode: ClockMode): string {
  const total = mode === 'timer' ? Math.ceil(ms / 1000) : Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

import { createStore } from 'zustand/vanilla';
import {
  clampDuration,
  newClock,
  pause,
  reset,
  start,
  type ClockMode,
  type ClockState,
} from '../../core/teaching/timer';

// מצב כלי ההוראה בזמן השיעור (זרקור, כיסוי, טיימר). לא נשמר בשיעור – רק תצוגה.

export type CoverSide = 'top' | 'bottom' | 'right' | 'left';

export interface TeachingState {
  spotlight: { on: boolean; radius: number };
  cover: { on: boolean; side: CoverSide; /** החלק המכוסה מהלוח, 0–1 */ amount: number };
  clock: (ClockState & { open: boolean; sound: boolean }) | null;

  toggleSpotlight(on?: boolean): void;
  setSpotlightRadius(r: number): void;
  toggleCover(on?: boolean): void;
  setCoverSide(side: CoverSide): void;
  setCoverAmount(amount: number): void;

  openClock(mode: ClockMode): void;
  closeClock(): void;
  setDuration(ms: number): void;
  startClock(): void;
  pauseClock(): void;
  resetClock(): void;
  setSound(on: boolean): void;
}

export type TeachingStore = ReturnType<typeof createTeachingStore>;

export const SPOTLIGHT_LIMITS = { min: 60, max: 400 } as const;

export function createTeachingStore(now: () => number = () => Date.now()) {
  return createStore<TeachingState>()((set, get) => {
    const clock = (fn: (c: NonNullable<TeachingState['clock']>) => ClockState) => {
      const c = get().clock;
      if (c) set({ clock: { ...c, ...fn(c) } });
    };
    return {
      spotlight: { on: false, radius: 150 },
      cover: { on: false, side: 'top', amount: 0.85 },
      clock: null,

      toggleSpotlight: (on) =>
        set({ spotlight: { ...get().spotlight, on: on ?? !get().spotlight.on } }),
      setSpotlightRadius: (r) =>
        set({
          spotlight: {
            ...get().spotlight,
            radius: Math.min(SPOTLIGHT_LIMITS.max, Math.max(SPOTLIGHT_LIMITS.min, r)),
          },
        }),
      toggleCover: (on) => {
        const next = on ?? !get().cover.on;
        // כיסוי חדש מתחיל כמעט מלא
        set({ cover: { ...get().cover, on: next, amount: next ? 0.85 : get().cover.amount } });
      },
      setCoverSide: (side) => set({ cover: { ...get().cover, side } }),
      setCoverAmount: (amount) =>
        set({ cover: { ...get().cover, amount: Math.min(1, Math.max(0, amount)) } }),

      openClock: (mode) => {
        const c = get().clock;
        if (c && c.mode === mode) set({ clock: { ...c, open: true } });
        else
          set({
            clock: { ...newClock(mode, c?.durationMs), open: true, sound: c?.sound ?? true },
          });
      },
      closeClock: () => set({ clock: null }),
      setDuration: (ms) => clock((c) => ({ ...reset(c), durationMs: clampDuration(ms) })),
      startClock: () => clock((c) => start(c, now())),
      pauseClock: () => clock((c) => pause(c, now())),
      resetClock: () => clock((c) => reset(c)),
      setSound: (on) => {
        const c = get().clock;
        if (c) set({ clock: { ...c, sound: on } });
      },
    };
  });
}

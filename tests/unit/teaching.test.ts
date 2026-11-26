import { describe, expect, it } from 'vitest';
import {
  displayMs,
  formatClock,
  isFinished,
  newClock,
  pause,
  reset,
  start,
} from '../../src/core/teaching/timer';
import { createTeachingStore } from '../../src/features/teaching/teachingStore';
import { QUICK_ACTION_IDS } from '../../src/app/actionIds';
import { ACTIONS } from '../../src/app/actions';

describe('timer and stopwatch', () => {
  it('counts down, pauses and finishes by real time (not by screen updates)', () => {
    let c = newClock('timer', 60_000);
    c = start(c, 1000);
    expect(displayMs(c, 11_000)).toBe(50_000);
    c = pause(c, 11_000);
    expect(displayMs(c, 99_000)).toBe(50_000); // עצור – לא ממשיך לרדת
    c = start(c, 100_000);
    expect(isFinished(c, 149_999)).toBe(false);
    expect(isFinished(c, 150_000)).toBe(true);
    expect(displayMs(c, 200_000)).toBe(0);
    expect(start(c, 200_000)).toBe(c); // אחרי הסוף לא מתחיל שוב בלי איפוס
    expect(displayMs(reset(c), 0)).toBe(60_000);
  });

  it('stopwatch counts up', () => {
    const c = start(newClock('stopwatch'), 0);
    expect(displayMs(c, 75_400)).toBe(75_400);
    expect(isFinished(c, 1e9)).toBe(false);
  });

  it('formats like a real clock', () => {
    expect(formatClock(5 * 60_000, 'timer')).toBe('5:00');
    expect(formatClock(59_001, 'timer')).toBe('1:00'); // מעוגל למעלה בטיימר
    expect(formatClock(59_999, 'stopwatch')).toBe('0:59');
    expect(formatClock(3_723_000, 'stopwatch')).toBe('1:02:03');
  });
});

describe('teaching store', () => {
  it('spotlight size is limited; cover amount stays between 0 and 1', () => {
    const s = createTeachingStore(() => 0);
    s.getState().toggleSpotlight();
    s.getState().setSpotlightRadius(5000);
    expect(s.getState().spotlight).toEqual({ on: true, radius: 400 });
    s.getState().toggleCover();
    s.getState().setCoverAmount(-3);
    expect(s.getState().cover.amount).toBe(0);
    s.getState().setCoverAmount(0.4);
    expect(s.getState().cover.amount).toBe(0.4);
  });

  it('timer: choosing a duration resets it; switching to stopwatch keeps the sound choice', () => {
    let now = 0;
    const s = createTeachingStore(() => now);
    s.getState().openClock('timer');
    s.getState().setSound(false);
    s.getState().setDuration(3 * 60_000);
    s.getState().startClock();
    now = 30_000;
    s.getState().pauseClock();
    expect(s.getState().clock!.accumulatedMs).toBe(30_000);
    s.getState().setDuration(60_000);
    expect(s.getState().clock!.accumulatedMs).toBe(0);
    s.getState().openClock('stopwatch');
    expect(s.getState().clock).toMatchObject({ mode: 'stopwatch', sound: false });
  });

  it('every teaching quick action exists', () => {
    for (const id of QUICK_ACTION_IDS.filter(
      (x) => x.startsWith('teaching.') || x === 'tool.laser',
    ))
      expect(ACTIONS[id]).toBeDefined();
  });
});

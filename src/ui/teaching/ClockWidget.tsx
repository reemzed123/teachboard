import { Pause, Play, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useRuntime, useTeaching } from '../../app/StoreContext';
import { displayMs, formatClock, isFinished } from '../../core/teaching/timer';
import { playEndTone } from '../../features/teaching/beep';
import { t } from '../../i18n';

export const TIMER_PRESETS_MIN = [1, 3, 5, 10] as const;

/** חלון קטן וצף של טיימר / שעון עצר. אפשר לגרור אותו לכל מקום על הלוח. */
export function ClockWidget() {
  const rt = useRuntime();
  const clock = useTeaching((s) => s.clock);
  const [now, setNow] = useState(() => Date.now());
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const announced = useRef(false);

  const running = clock?.startedAt != null;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [running]);

  const finished = clock ? isFinished(clock, now) : false;
  // סיום: צליל פעם אחת, ועצירה
  useEffect(() => {
    if (!clock) return;
    if (finished && !announced.current) {
      announced.current = true;
      if (clock.sound) playEndTone();
      rt.teaching.getState().pauseClock();
    }
    if (!finished) announced.current = false;
  }, [finished, clock, rt]);

  if (!clock) return null;
  const s = rt.teaching.getState();
  const text = formatClock(displayMs(clock, now), clock.mode);

  const onDragStart = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const el = ref.current;
    const host = el?.parentElement;
    if (!el || !host) return;
    e.preventDefault();
    const box = el.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    const dx = e.clientX - box.left;
    const dy = e.clientY - box.top;
    const move = (ev: PointerEvent) =>
      setPos({
        x: Math.min(hr.width - box.width, Math.max(0, ev.clientX - hr.left - dx)),
        y: Math.min(hr.height - box.height, Math.max(0, ev.clientY - hr.top - dy)),
      });
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div
      ref={ref}
      className="tb-clock"
      data-testid="clock"
      data-finished={finished || undefined}
      role="timer"
      aria-label={clock.mode === 'timer' ? t('teaching.timer') : t('teaching.stopwatch')}
      style={pos ? { left: pos.x, top: pos.y, insetInlineEnd: 'auto' } : undefined}
      onPointerDown={onDragStart}
    >
      <div className="tb-clock-head">
        <span>{clock.mode === 'timer' ? t('teaching.timer') : t('teaching.stopwatch')}</span>
        <button
          type="button"
          className="tb-clock-icon"
          aria-label={clock.sound ? t('teaching.soundOff') : t('teaching.soundOn')}
          title={clock.sound ? t('teaching.soundOff') : t('teaching.soundOn')}
          hidden={clock.mode !== 'timer'}
          onClick={() => s.setSound(!clock.sound)}
        >
          {clock.sound ? <Volume2 size={16} /> : <VolumeX size={16} />}
        </button>
        <button
          type="button"
          className="tb-clock-icon"
          aria-label={t('teaching.clockClose')}
          title={t('teaching.clockClose')}
          onClick={() => s.closeClock()}
        >
          <X size={16} />
        </button>
      </div>
      <div className="tb-clock-time" data-testid="clock-time" dir="ltr">
        {finished ? t('teaching.timeUp') : text}
      </div>
      {clock.mode === 'timer' && !running && clock.accumulatedMs === 0 && (
        <div className="tb-clock-presets">
          {TIMER_PRESETS_MIN.map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={clock.durationMs === m * 60_000}
              onClick={() => s.setDuration(m * 60_000)}
            >
              {t('teaching.minutes', { n: m })}
            </button>
          ))}
        </div>
      )}
      <div className="tb-clock-controls">
        <button
          type="button"
          className="tb-btn tb-btn-primary"
          disabled={finished}
          onClick={() => (running ? s.pauseClock() : s.startClock())}
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
          {running ? t('teaching.pause') : t('teaching.start')}
        </button>
        <button type="button" className="tb-btn" onClick={() => s.resetClock()}>
          <RotateCcw size={16} />
          {t('teaching.reset')}
        </button>
      </div>
    </div>
  );
}

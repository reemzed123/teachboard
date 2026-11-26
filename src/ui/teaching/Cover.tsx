import { X } from 'lucide-react';
import { useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { useRuntime, useTeaching } from '../../app/StoreContext';
import { t } from '../../i18n';

/**
 * כיסוי וחשיפה: "וילון" שמכסה חלק מהלוח. גוררים את הידית כדי לחשוף בהדרגה.
 * החלק המכוסה לא מקבל לחיצות (לא כותבים בטעות במקום שלא רואים).
 */
export function Cover() {
  const rt = useRuntime();
  const { on, side, amount } = useTeaching((s) => s.cover);
  const ref = useRef<HTMLDivElement>(null);

  if (!on) return null;
  const horizontal = side === 'left' || side === 'right';

  const onPointerDown = (e: ReactPointerEvent) => {
    const host = ref.current?.parentElement;
    if (!host) return;
    e.preventDefault();
    const move = (ev: PointerEvent) => {
      const r = host.getBoundingClientRect();
      const f =
        side === 'top'
          ? (ev.clientY - r.top) / r.height
          : side === 'bottom'
            ? (r.bottom - ev.clientY) / r.height
            : side === 'left'
              ? (ev.clientX - r.left) / r.width
              : (r.right - ev.clientX) / r.width;
      rt.teaching.getState().setCoverAmount(f);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  // חצים: מקטינים/מגדילים את הכיסוי
  const onKeyDown = (e: React.KeyboardEvent) => {
    const keys: Record<string, number> = {
      ArrowUp: side === 'top' ? -1 : side === 'bottom' ? 1 : 0,
      ArrowDown: side === 'top' ? 1 : side === 'bottom' ? -1 : 0,
      ArrowLeft: side === 'left' ? -1 : side === 'right' ? 1 : 0,
      ArrowRight: side === 'left' ? 1 : side === 'right' ? -1 : 0,
    };
    const dir = keys[e.key];
    if (!dir) return;
    e.preventDefault();
    e.stopPropagation();
    rt.teaching.getState().setCoverAmount(amount + dir * 0.05);
  };

  const size = `${amount * 100}%`;
  return (
    <div
      ref={ref}
      className="tb-cover"
      data-side={side}
      data-testid="cover"
      style={horizontal ? { width: size } : { height: size }}
    >
      <span className="tb-cover-text">{t('teaching.coverHint')}</span>
      <button
        type="button"
        className="tb-cover-handle"
        aria-label={t('teaching.coverDrag')}
        data-testid="cover-handle"
        onPointerDown={onPointerDown}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="tb-cover-close"
        aria-label={t('teaching.coverClose')}
        title={t('teaching.coverClose')}
        onClick={() => rt.teaching.getState().toggleCover(false)}
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

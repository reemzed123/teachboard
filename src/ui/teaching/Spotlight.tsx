import { useEffect, useRef, type CSSProperties } from 'react';
import { useRuntime, useTeaching } from '../../app/StoreContext';

/**
 * זרקור: כל הלוח מוחשך חוץ מעיגול סביב העט/העכבר.
 * לא חוסם לחיצות – אפשר להמשיך לכתוב בתוך האור. Alt + גלגלת משנה את הגודל.
 */
export function Spotlight() {
  const rt = useRuntime();
  const { on, radius } = useTeaching((s) => s.spotlight);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!on || !el) return;
    const host = el.parentElement!;
    const place = (x: number, y: number) => {
      const r = host.getBoundingClientRect();
      el.style.setProperty('--tb-spot-x', `${x - r.left}px`);
      el.style.setProperty('--tb-spot-y', `${y - r.top}px`);
    };
    // מתחילים באמצע הלוח
    const r = host.getBoundingClientRect();
    place(r.left + r.width / 2, r.top + r.height / 2);
    const onMove = (e: PointerEvent) => place(e.clientX, e.clientY);
    const onWheel = (e: WheelEvent) => {
      if (!e.altKey) return;
      e.preventDefault();
      e.stopPropagation();
      const s = rt.teaching.getState();
      s.setSpotlightRadius(s.spotlight.radius * (e.deltaY < 0 ? 1.1 : 0.9));
    };
    const opts = { capture: true, passive: true } as const;
    host.addEventListener('pointermove', onMove, opts);
    host.addEventListener('pointerdown', onMove, opts);
    host.addEventListener('wheel', onWheel, { capture: true, passive: false });
    return () => {
      host.removeEventListener('pointermove', onMove, opts);
      host.removeEventListener('pointerdown', onMove, opts);
      host.removeEventListener('wheel', onWheel, { capture: true });
    };
  }, [on, rt]);

  if (!on) return null;
  return (
    <div
      ref={ref}
      className="tb-spotlight"
      data-testid="spotlight"
      aria-hidden="true"
      style={{ '--tb-spot-r': `${radius}px` } as CSSProperties}
    />
  );
}

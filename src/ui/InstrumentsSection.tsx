import { Compass as CompassIcon, Ruler, Triangle } from 'lucide-react';
import { useBoard, useRuntime } from '../app/StoreContext';
import type { Instruments } from '../core/instruments';
import { UNITS_PER_CM } from '../core/geometry/construction';
import { visibleBoardRect } from '../engine/viewport';
import { t } from '../i18n';
import type { MessageKey } from '../i18n/he';

/** כפתורי הכלים הווירטואליים (בחלונית "ציור וכתיבה") */
export function InstrumentsSection() {
  const rt = useRuntime();
  const ins = useBoard((s) => s.instruments);
  const toggle = (kind: keyof Instruments, extra: Record<string, unknown> = {}) => {
    const s = rt.board.getState();
    const host = document.querySelector('[data-testid=board]') as HTMLElement | null;
    const a = visibleBoardRect(s.view, host?.clientWidth ?? 800, host?.clientHeight ?? 600);
    const cx = a.x + a.width / 2;
    const cy = a.y + a.height / 2;
    s.setInstruments((i) => {
      const next = { ...i };
      if (next[kind] && !extra.kind) delete next[kind];
      else if (kind === 'compass') next.compass = { cx, cy, r: 3 * UNITS_PER_CM, angle: 0 };
      else Object.assign(next, { [kind]: { x: cx, y: cy, angle: 0, ...extra } });
      return next;
    });
  };
  const btn = (
    kind: keyof Instruments,
    label: MessageKey,
    icon: React.ReactNode,
    extra?: Record<string, unknown>,
    pressed?: boolean,
  ) => (
    <button
      type="button"
      className="tb-btn tb-btn-tool"
      aria-pressed={pressed ?? !!ins[kind]}
      data-instrument-toggle={label}
      onClick={() => {
        if (pressed) {
          // לחיצה שנייה על אותו סוג משולש – מסירה
          rt.board.getState().setInstruments((i) => {
            const n = { ...i };
            delete n.setSquare;
            return n;
          });
        } else toggle(kind, extra);
      }}
    >
      {icon}
      {t(label)}
    </button>
  );
  return (
    <fieldset className="tb-field">
      <legend>{t('instr.title')}</legend>
      <div className="tb-button-column">
        {btn('ruler', 'instr.ruler', <Ruler size={18} aria-hidden="true" />)}
        {btn('protractor', 'instr.protractor', <span aria-hidden="true">◠</span>)}
        {btn(
          'setSquare',
          'instr.setSquare45',
          <Triangle size={18} aria-hidden="true" />,
          { kind: '45' },
          ins.setSquare?.kind === '45',
        )}
        {btn(
          'setSquare',
          'instr.setSquare60',
          <Triangle size={18} aria-hidden="true" />,
          { kind: '60' },
          ins.setSquare?.kind === '60',
        )}
        {btn('compass', 'instr.compass', <CompassIcon size={18} aria-hidden="true" />)}
      </div>
      <p className="tb-help">{t('instr.help')}</p>
    </fieldset>
  );
}

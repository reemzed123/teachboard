import { useRuntime } from '../app/StoreContext';
import { newId } from '../core/document/ids';
import type {
  BoardObject,
  FractionBarsObject,
  NumberLineObject,
  TableObject,
} from '../core/document/types';
import { visibleBoardRect } from '../engine/viewport';
import { t } from '../i18n';

const FRACTION_CHOICES = [1, 2, 3, 4, 5, 6, 8, 10, 12];

/** מרכז האזור הנראה – כדי שהעזר החדש יופיע מול העיניים */
function placeCenter(rt: ReturnType<typeof useRuntime>, w: number, h: number) {
  const s = rt.board.getState();
  const host = document.querySelector('[data-testid=board]') as HTMLElement | null;
  const a = visibleBoardRect(s.view, host?.clientWidth ?? 800, host?.clientHeight ?? 600);
  return { x: a.x + a.width / 2 - w / 2, y: a.y + a.height / 2 - h / 2, rotation: 0, scale: 1 };
}

/** עזרים מתמטיים: ציר מספרים, רצועות שברים, לוח 100 – הוספה ועריכה של הנבחר */
export function MathProps({ selected }: { selected: BoardObject | null }) {
  const rt = useRuntime();
  const add = (o: BoardObject) => {
    const s = rt.board.getState();
    s.commit('prop', [{ type: 'add', pageId: s.pageId, objects: [o] }]);
    s.setTool('select');
    s.setSelection([o.id]);
  };
  const update = (o: BoardObject) => {
    const s = rt.board.getState();
    s.commit('propEdit', [{ type: 'replace', pageId: s.pageId, objects: [o] }]);
  };

  const addNumberLine = () =>
    add({
      id: newId(),
      type: 'numberline',
      transform: placeCenter(rt, 720, 70),
      from: -10,
      to: 10,
      step: 1,
      width: 720,
      height: 70,
      color: '#1c2430',
    });
  const addFractions = () =>
    add({
      id: newId(),
      type: 'fractions',
      transform: placeCenter(rt, 600, 6 * 44),
      denominators: [1, 2, 3, 4, 6, 8],
      width: 600,
      rowHeight: 44,
      color: '#1c2430',
    });
  const addHundred = () => {
    const rows = Array.from({ length: 10 }, (_, r) =>
      Array.from({ length: 10 }, (_, c) => String(r * 10 + c + 1)),
    );
    const o: TableObject = {
      id: newId(),
      type: 'table',
      transform: placeCenter(rt, 520, 520),
      rows,
      fontSize: 20,
      color: '#1c2430',
      cellWidth: 52,
      cellHeight: 52,
      header: false,
      dir: 'ltr',
    };
    add(o);
  };

  return (
    <fieldset className="tb-field" data-testid="math-props">
      <legend>{t('props.title')}</legend>
      <div className="tb-button-column">
        <button type="button" className="tb-btn" data-prop="numberline" onClick={addNumberLine}>
          {t('props.numberLine')}
        </button>
        <button type="button" className="tb-btn" data-prop="fractions" onClick={addFractions}>
          {t('props.fractions')}
        </button>
        <button type="button" className="tb-btn" data-prop="hundred" onClick={addHundred}>
          {t('props.hundred')}
        </button>
      </div>
      {selected?.type === 'numberline' && (
        <NumberLineEditor key={selected.id} o={selected} onChange={update} />
      )}
      {selected?.type === 'fractions' && <FractionsEditor o={selected} onChange={update} />}
      <p className="tb-help">{t('props.help')}</p>
    </fieldset>
  );
}

function NumberLineEditor({
  o,
  onChange,
}: {
  o: NumberLineObject;
  onChange: (o: NumberLineObject) => void;
}) {
  const field = (k: 'from' | 'to' | 'step', label: string) => (
    <label className="tb-select-inline tb-geo-dim">
      {label}
      <input
        className="tb-input tb-input-small"
        type="number"
        data-numberline={k}
        defaultValue={o[k]}
        step="any"
        onBlur={(e) => {
          const v = Number(e.target.value);
          const next = { ...o, [k]: v };
          // תקין: סוף אחרי התחלה, צעד חיובי, לא יותר מ-1000 שנתות
          if (
            Number.isFinite(v) &&
            next.to > next.from &&
            next.step > 0 &&
            (next.to - next.from) / next.step <= 1000
          )
            onChange(next);
          else e.target.value = String(o[k]);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );
  return (
    <div className="tb-field" data-testid="numberline-editor">
      {field('from', t('props.from'))}
      {field('to', t('props.to'))}
      {field('step', t('props.step'))}
    </div>
  );
}

function FractionsEditor({
  o,
  onChange,
}: {
  o: FractionBarsObject;
  onChange: (o: FractionBarsObject) => void;
}) {
  return (
    <div className="tb-field" data-testid="fractions-editor">
      <p className="tb-help">{t('props.fractionRows')}</p>
      <div className="tb-fraction-choices">
        {FRACTION_CHOICES.map((d) => (
          <label key={d} className="tb-check">
            <input
              type="checkbox"
              data-denominator={d}
              checked={o.denominators.includes(d)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...o.denominators, d].sort((a, b) => a - b)
                  : o.denominators.filter((x) => x !== d);
                if (next.length) onChange({ ...o, denominators: next });
              }}
            />
            {d === 1 ? '1' : `1/${d}`}
          </label>
        ))}
      </div>
    </div>
  );
}

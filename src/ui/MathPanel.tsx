import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Crosshair,
  Eye,
  EyeOff,
  Trash2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { newId } from '../core/document/ids';
import {
  IDENTITY_TRANSFORM,
  type GraphFunction,
  type GraphObject,
  type TableObject,
} from '../core/document/types';
import { formatNumber, valueTable } from '../core/math/numeric';
import { defaultRange, functionName, panGraph, zoomGraph } from '../core/math/graphView';
import { useBoard, useRuntime } from '../app/StoreContext';
import { currentPage } from '../features/board/boardStore';
import { loadMathLive } from '../features/math/mathlive';
import { functionFor } from '../engine/render/drawGraph';
import { visibleBoardRect } from '../engine/viewport';
import { t } from '../i18n';
import { IconButton } from './IconButton';
import { SidePanel } from './SidePanel';

const GRAPH_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ea580c', '#7c3aed', '#0891b2'];

/** חלונית המתמטיקה: נוסחה חדשה, מערכת צירים חדשה, ועריכת הגרף שנבחר. */
export function MathPanel() {
  const rt = useRuntime();
  const selected = useBoard((s) => {
    if (s.selection.length !== 1) return null;
    return currentPage(s).objects.find((o) => o.id === s.selection[0]) ?? null;
  });

  const addGraph = () => {
    const s = rt.board.getState();
    const host = document.querySelector('[data-testid=board]') as HTMLElement | null;
    const area = visibleBoardRect(s.view, host?.clientWidth ?? 800, host?.clientHeight ?? 600);
    const width = 480;
    const height = 360;
    const g: GraphObject = {
      id: newId(),
      type: 'graph',
      transform: {
        ...IDENTITY_TRANSFORM,
        x: area.x + area.width / 2 - width / 2,
        y: area.y + area.height / 2 - height / 2,
      },
      width,
      height,
      range: defaultRange(width, height),
      grid: true,
      showIntercepts: true,
      showIntersections: true,
      functions: [],
    };
    s.commit('graph', [{ type: 'add', pageId: s.pageId, objects: [g] }]);
    s.setTool('select');
    s.setSelection([g.id]);
  };

  return (
    <SidePanel title={t('category.math')}>
      <div className="tb-button-column tb-field">
        <button
          type="button"
          className="tb-btn"
          onClick={() => rt.board.getState().openFormula(null)}
        >
          {t('math.newFormula')}
        </button>
        <button type="button" className="tb-btn" onClick={addGraph}>
          {t('math.newGraph')}
        </button>
      </div>
      {selected?.type === 'math' && (
        <div className="tb-field">
          <button
            type="button"
            className="tb-btn"
            onClick={() => rt.board.getState().openFormula(selected.id)}
          >
            {t('math.editFormula')}
          </button>
        </div>
      )}
      {selected?.type === 'graph' ? (
        <GraphEditor key={selected.id} graph={selected} />
      ) : (
        <p className="tb-help">{t('math.selectGraphHelp')}</p>
      )}
    </SidePanel>
  );
}

function GraphEditor({ graph }: { graph: GraphObject }) {
  const rt = useRuntime();
  const id = useId();
  /** עדכון לפי המצב הנוכחי של הגרף בלוח (לא לפי עותק ישן) – כדי ששינוי לא ילך לאיבוד */
  const update = (fn: (g: GraphObject) => Partial<GraphObject> | null) => {
    const s = rt.board.getState();
    const current = currentPage(s).objects.find((o) => o.id === graph.id);
    if (current?.type !== 'graph') return;
    const patch = fn(current);
    if (!patch) return;
    s.commit('graph', [{ type: 'replace', pageId: s.pageId, objects: [{ ...current, ...patch }] }]);
  };
  const setFunction = (fid: string, patch: Partial<GraphFunction>) =>
    update((g) => {
      const f = g.functions.find((x) => x.id === fid);
      // בלי שינוי אמיתי – לא נרשם צעד לביטול
      if (!f || Object.entries(patch).every(([k, v]) => f[k as keyof GraphFunction] === v))
        return null;
      return { functions: g.functions.map((x) => (x.id === fid ? { ...x, ...patch } : x)) };
    });

  const addFunction = () =>
    update((g) => ({
      functions: [
        ...g.functions,
        {
          id: newId('f'),
          latex: '',
          color: GRAPH_COLORS[g.functions.length % GRAPH_COLORS.length]!,
          width: 2.5,
          visible: true,
        },
      ],
    }));

  return (
    <>
      <fieldset className="tb-field">
        <legend>{t('math.functions')}</legend>
        {graph.functions.length === 0 && <p className="tb-help">{t('math.noFunctions')}</p>}
        <ul className="tb-fn-list">
          {graph.functions.map((f, i) => (
            <FunctionRow
              key={f.id}
              index={i}
              fn={f}
              onChange={(patch) => setFunction(f.id, patch)}
              onRemove={() =>
                update((g) => ({ functions: g.functions.filter((x) => x.id !== f.id) }))
              }
            />
          ))}
        </ul>
        <button
          type="button"
          className="tb-btn"
          onClick={addFunction}
          disabled={graph.functions.length >= 8}
        >
          {t('math.addFunction')}
        </button>
        <p className="tb-help">{t('math.functionHelp')}</p>
      </fieldset>

      <fieldset className="tb-field">
        <legend>{t('math.range')}</legend>
        <p className="tb-help">{t('math.rangeHelp')}</p>
        <div className="tb-graph-nav" role="toolbar" aria-label={t('math.navigate')}>
          <IconButton
            icon={ZoomIn}
            label={t('math.zoomIn')}
            tooltipSide="below"
            onClick={() => update((g) => ({ range: zoomGraph(g, 0.8) }))}
          />
          <IconButton
            icon={ZoomOut}
            label={t('math.zoomOut')}
            tooltipSide="below"
            onClick={() => update((g) => ({ range: zoomGraph(g, 1.25) }))}
          />
          <IconButton
            icon={ArrowRight}
            label={t('math.panRight')}
            tooltipSide="below"
            onClick={() => update((g) => ({ range: panGraph(g, 0.2, 0) }))}
          />
          <IconButton
            icon={ArrowLeft}
            label={t('math.panLeft')}
            tooltipSide="below"
            onClick={() => update((g) => ({ range: panGraph(g, -0.2, 0) }))}
          />
          <IconButton
            icon={ArrowUp}
            label={t('math.panUp')}
            tooltipSide="below"
            onClick={() => update((g) => ({ range: panGraph(g, 0, 0.2) }))}
          />
          <IconButton
            icon={ArrowDown}
            label={t('math.panDown')}
            tooltipSide="below"
            onClick={() => update((g) => ({ range: panGraph(g, 0, -0.2) }))}
          />
          <IconButton
            icon={Crosshair}
            label={t('math.resetView')}
            tooltipSide="below"
            onClick={() => update((g) => ({ range: defaultRange(g.width, g.height) }))}
          />
        </div>
        <div className="tb-range-grid" dir="ltr">
          {(['xMin', 'xMax', 'yMin', 'yMax'] as const).map((k) => (
            <label key={k} className="tb-range-cell">
              <span>{t(`math.${k}`)}</span>
              <NumberInput
                id={`${id}-${k}`}
                value={graph.range[k]}
                onCommit={(v) =>
                  update((g) => {
                    const r = { ...g.range, [k]: v };
                    return r.xMin < r.xMax && r.yMin < r.yMax && g.range[k] !== v
                      ? { range: r }
                      : null;
                  })
                }
              />
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="tb-field">
        <legend>{t('math.display')}</legend>
        {(
          [
            ['grid', 'math.grid'],
            ['showIntercepts', 'math.intercepts'],
            ['showIntersections', 'math.intersections'],
            ['showExtrema', 'math.extrema'],
            ['showAsymptotes', 'math.asymptotes'],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="tb-check">
            <input
              type="checkbox"
              data-graph-option={k}
              checked={!!graph[k]}
              onChange={(e) => update(() => ({ [k]: e.target.checked }))}
            />
            {t(label)}
          </label>
        ))}
      </fieldset>

      <ValueTable graph={graph} />
    </>
  );
}

function FunctionRow({
  fn,
  index,
  onChange,
  onRemove,
}: {
  fn: GraphFunction;
  index: number;
  onChange(patch: Partial<GraphFunction>): void;
  onRemove(): void;
}) {
  const fieldRef = useRef<(HTMLElement & { value: string }) | null>(null);
  const [ready, setReady] = useState(false);
  const valid = fn.latex.trim() === '' || functionFor(fn.latex) !== null;

  useEffect(() => {
    let alive = true;
    void loadMathLive().then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const el = fieldRef.current;
    if (!ready || !el) return;
    if (el.value !== fn.latex) el.value = fn.latex;
    // "change" = Enter או יציאה מהשדה: רק אז מעדכנים את הגרף (ונרשם לביטול)
    const onChangeEv = () => onChange({ latex: el.value });
    el.addEventListener('change', onChangeEv);
    return () => el.removeEventListener('change', onChangeEv);
  }, [ready, fn.latex, onChange]);

  return (
    <li className="tb-fn-row">
      <label
        className="tb-fn-color"
        style={{ background: fn.color }}
        title={t('drawing.customColor')}
      >
        <input
          type="color"
          value={fn.color}
          aria-label={t('math.functionColor', { n: index + 1 })}
          onChange={(e) => onChange({ color: e.target.value })}
        />
      </label>
      <span className="tb-fn-label" dir="ltr">
        {functionName(index)}(x) =
      </span>
      <div className="tb-fn-field" dir="ltr">
        {ready ? (
          <math-field
            ref={(el) => {
              fieldRef.current = el as (HTMLElement & { value: string }) | null;
            }}
            aria-label={t('math.functionN', { n: index + 1 })}
            data-testid={`function-${index}`}
            math-virtual-keyboard-policy="auto"
          />
        ) : (
          <input
            className="tb-input"
            aria-label={t('math.functionN', { n: index + 1 })}
            defaultValue={fn.latex}
            onBlur={(e) => onChange({ latex: e.target.value })}
          />
        )}
      </div>
      <IconButton
        icon={fn.visible ? Eye : EyeOff}
        label={fn.visible ? t('math.hideFunction') : t('math.showFunction')}
        tooltipSide="below"
        onClick={() => onChange({ visible: !fn.visible })}
      />
      <IconButton
        icon={Trash2}
        label={t('math.removeFunction')}
        tooltipSide="below"
        onClick={onRemove}
      />
      {!valid && (
        <p className="tb-fn-error" role="alert">
          {t('math.parseError')}
        </p>
      )}
    </li>
  );
}

function NumberInput({
  id,
  value,
  onCommit,
}: {
  id: string;
  value: number;
  onCommit(v: number): void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      id={id}
      className="tb-input"
      inputMode="decimal"
      value={draft ?? String(value)}
      onFocus={() => setDraft(String(value))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const v = Number(draft);
        if (draft !== null && Number.isFinite(v)) onCommit(v);
        setDraft(null);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

/** טבלת ערכים לפונקציה שנבחרה, עם אפשרות להוסיף אותה ללוח */
function ValueTable({ graph }: { graph: GraphObject }) {
  const rt = useRuntime();
  const usable = graph.functions.filter((f) => f.latex.trim() && functionFor(f.latex));
  const [fnId, setFnId] = useState<string>('');
  const [from, setFrom] = useState(-2);
  const [step, setStep] = useState(1);
  const [count, setCount] = useState(5);
  const fn = usable.find((f) => f.id === fnId) ?? usable[0];
  const compiled = fn ? functionFor(fn.latex) : null;
  const rows = compiled ? valueTable(compiled, from, step, count) : [];

  if (usable.length === 0) return null;

  const insertTable = () => {
    const s = rt.board.getState();
    const cellWidth = 64;
    const table: TableObject = {
      id: newId(),
      type: 'table',
      transform: {
        ...IDENTITY_TRANSFORM,
        x: graph.transform.x + graph.width * graph.transform.scale + 24,
        y: graph.transform.y,
      },
      rows: [
        ['x', ...rows.map((r) => formatNumber(r.x))],
        ['y', ...rows.map((r) => formatNumber(r.y))],
      ],
      fontSize: 16,
      color: '#1c2430',
      cellWidth,
      cellHeight: 34,
    };
    s.commit('table', [{ type: 'add', pageId: s.pageId, objects: [table] }]);
  };

  return (
    <fieldset className="tb-field">
      <legend>{t('math.valueTable')}</legend>
      {usable.length > 1 && (
        <label className="tb-select-inline">
          {t('math.tableFunction')}
          <select value={fn?.id} onChange={(e) => setFnId(e.target.value)} dir="ltr">
            {usable.map((f) => (
              <option key={f.id} value={f.id}>
                {`${functionName(graph.functions.indexOf(f))}(x) = ${f.latex}`}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="tb-range-grid" dir="ltr">
        <label className="tb-range-cell">
          <span>{t('math.tableFrom')}</span>
          <NumberInput id="tbl-from" value={from} onCommit={setFrom} />
        </label>
        <label className="tb-range-cell">
          <span>{t('math.tableStep')}</span>
          <NumberInput id="tbl-step" value={step} onCommit={(v) => v > 0 && setStep(v)} />
        </label>
        <label className="tb-range-cell">
          <span>{t('math.tableCount')}</span>
          <NumberInput
            id="tbl-count"
            value={count}
            onCommit={(v) => setCount(Math.max(1, Math.min(20, Math.round(v))))}
          />
        </label>
      </div>
      <div className="tb-value-table-wrap" dir="ltr">
        <table className="tb-value-table" data-testid="value-table">
          <tbody>
            <tr>
              <th>x</th>
              {rows.map((r) => (
                <td key={r.x}>{formatNumber(r.x)}</td>
              ))}
            </tr>
            <tr>
              <th>y</th>
              {rows.map((r) => (
                <td key={r.x}>{formatNumber(r.y)}</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" className="tb-btn" onClick={insertTable}>
        {t('math.insertTable')}
      </button>
    </fieldset>
  );
}

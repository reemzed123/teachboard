import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useRuntime } from '../app/StoreContext';
import type { GraphObject, GraphParam } from '../core/document/types';
import { snapParam } from '../core/math/params';
import { formatNumber } from '../core/math/numeric';
import { currentPage } from '../features/board/boardStore';
import { t } from '../i18n';

/**
 * מחוונים לפרמטרים של הגרף (a, b…): הגרף משתנה בזמן הגרירה,
 * ונשמר צעד אחד לביטול בסוף. ▶ – הנפשה של הפרמטר בין המינימום למקסימום.
 */
export function GraphSliders({ graph }: { graph: GraphObject }) {
  const params = graph.params ?? {};
  return (
    <fieldset className="tb-field" data-testid="graph-sliders">
      <legend>{t('math.params')}</legend>
      {Object.entries(params).map(([name, p]) => (
        <ParamSlider key={name} graphId={graph.id} name={name} param={p} />
      ))}
      <p className="tb-help">{t('math.paramsHelp')}</p>
    </fieldset>
  );
}

function ParamSlider({
  graphId,
  name,
  param,
}: {
  graphId: string;
  name: string;
  param: GraphParam;
}) {
  const rt = useRuntime();
  const [live, setLive] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const liveRef = useRef<number | null>(null);
  const rangeRef = useRef<HTMLInputElement>(null);
  const value = live ?? param.value;
  const commitRef = useRef<() => void>(() => {});

  const currentGraph = () => {
    const s = rt.board.getState();
    const g = currentPage(s).objects.find((o) => o.id === graphId);
    return g?.type === 'graph' ? g : null;
  };
  const withParam = (g: GraphObject, patch: Partial<GraphParam>): GraphObject => ({
    ...g,
    params: { ...g.params, [name]: { ...g.params![name]!, ...patch } },
  });
  /** תצוגה בלבד (בזמן גרירה/הנפשה) */
  const preview = (v: number) => {
    const g = currentGraph();
    liveRef.current = v;
    setLive(v);
    if (g) rt.engine?.previewObjects([withParam(g, { value: v })]);
  };
  /** שמירה (צעד אחד לביטול) */
  const commit = (patch: Partial<GraphParam>) => {
    const g = currentGraph();
    liveRef.current = null;
    setLive(null);
    if (!g) return;
    rt.engine?.endPreview([g.id]);
    const s = rt.board.getState();
    s.commit('graphParam', [{ type: 'replace', pageId: s.pageId, objects: [withParam(g, patch)] }]);
  };

  // סוף גרירה של המחוון: האירוע "change" של הדפדפן (לא תמיד מגיע pointerup)
  useEffect(() => {
    commitRef.current = () => {
      if (liveRef.current !== null) commit({ value: liveRef.current });
    };
  });
  useEffect(() => {
    const el = rangeRef.current;
    if (!el) return;
    const onChange = () => commitRef.current();
    el.addEventListener('change', onChange);
    return () => el.removeEventListener('change', onChange);
  }, []);

  // הנפשה: הלוך-חזור בין המינימום למקסימום
  useEffect(() => {
    if (!playing) return;
    let dir = 1;
    let v = param.value;
    const span = param.max - param.min;
    const id = setInterval(() => {
      v += dir * Math.max(param.step, span / 120);
      if (v >= param.max) {
        v = param.max;
        dir = -1;
      } else if (v <= param.min) {
        v = param.min;
        dir = 1;
      }
      preview(snapParam(param, v));
    }, 50);
    return () => {
      clearInterval(id);
      if (liveRef.current !== null) commit({ value: liveRef.current });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ההנפשה מתחילה מחדש רק בהפעלה/עצירה
  }, [playing]);

  const bound = (k: 'min' | 'max' | 'step', label: string) => (
    <label className="tb-param-bound">
      {label}
      <input
        className="tb-input tb-input-small"
        type="number"
        step="any"
        dir="ltr"
        data-param-bound={`${name}-${k}`}
        defaultValue={param[k]}
        key={`${k}-${param[k]}`}
        onBlur={(e) => {
          const v = Number(e.target.value);
          const next = { ...param, [k]: v };
          if (
            Number.isFinite(v) &&
            next.max > next.min &&
            next.step > 0 &&
            next.step <= next.max - next.min
          )
            commit({ [k]: v, value: snapParam(next, param.value) });
          else e.target.value = String(param[k]);
        }}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </label>
  );

  return (
    <div className="tb-param" data-param={name}>
      <div className="tb-param-row">
        <span className="tb-param-name" dir="ltr">
          {name} = {formatNumber(value, 3)}
        </span>
        <button
          type="button"
          className="tb-icon-mini"
          aria-label={playing ? t('math.paramStop') : t('math.paramPlay')}
          title={playing ? t('math.paramStop') : t('math.paramPlay')}
          data-param-play={name}
          onClick={() => setPlaying(!playing)}
        >
          {playing ? <Pause size={16} /> : <Play size={16} />}
        </button>
      </div>
      <input
        ref={rangeRef}
        type="range"
        className="tb-param-range"
        dir="ltr"
        min={param.min}
        max={param.max}
        step={param.step}
        value={value}
        aria-label={t('math.paramValue', { name })}
        data-param-slider={name}
        disabled={playing}
        onChange={(e) => preview(Number(e.target.value))}
        onBlur={() => commitRef.current()}
      />
      <div className="tb-param-bounds">
        {bound('min', t('math.paramMin'))}
        {bound('max', t('math.paramMax'))}
        {bound('step', t('math.paramStep'))}
      </div>
    </div>
  );
}

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { useBoard, useRuntime } from '../app/StoreContext';
import { newId } from '../core/document/ids';
import { IDENTITY_TRANSFORM, type InkObject } from '../core/document/types';
import { UNITS_PER_CM } from '../core/geometry/construction';
import {
  arcPoints,
  PROTRACTOR_R,
  RULER,
  setSquareCorners,
  unwrapAngle,
  type CompassState,
  type Instruments,
  type Placed,
} from '../core/instruments';
import { t } from '../i18n';

// כלי מדידה ושרטוט על הלוח: סרגל, מד-זווית, משולש, מחוגה.
// מצוירים ב-SVG מעל הלוח, בקואורדינטות לוח (גדלים עם הזום, כמו דף אמיתי).

type Kind = 'ruler' | 'protractor' | 'setSquare';

/** נקודת מסך → קואורדינטות לוח */
function toBoard(rt: ReturnType<typeof useRuntime>, clientX: number, clientY: number) {
  const host = document.querySelector('[data-testid=board]');
  const r = host?.getBoundingClientRect() ?? { left: 0, top: 0 };
  const v = rt.board.getState().view;
  return { x: (clientX - r.left - v.x) / v.scale, y: (clientY - r.top - v.y) / v.scale };
}

/** גרירה עם תפיסת המצביע */
function startDrag(
  e: ReactPointerEvent,
  onMove: (ev: PointerEvent) => void,
  onEnd?: (ev: PointerEvent) => void,
) {
  e.preventDefault();
  e.stopPropagation();
  const el = e.currentTarget as Element;
  el.setPointerCapture?.(e.pointerId);
  const move = (ev: PointerEvent) => onMove(ev);
  const up = (ev: PointerEvent) => {
    el.removeEventListener('pointermove', move as EventListener);
    el.removeEventListener('pointerup', up as EventListener);
    el.removeEventListener('pointercancel', up as EventListener);
    onEnd?.(ev);
  };
  el.addEventListener('pointermove', move as EventListener);
  el.addEventListener('pointerup', up as EventListener);
  el.addEventListener('pointercancel', up as EventListener);
}

export function InstrumentsOverlay() {
  const ins = useBoard((s) => s.instruments);
  const view = useBoard((s) => s.view);
  const [rotating, setRotating] = useState<{ kind: string; angle: number } | null>(null);
  if (!ins.ruler && !ins.protractor && !ins.setSquare && !ins.compass) return null;
  return (
    <svg className="tb-instruments" data-testid="instruments" aria-hidden="true">
      <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
        {ins.ruler && (
          <PlacedTool kind="ruler" p={ins.ruler} onRotate={setRotating}>
            <RulerShape />
          </PlacedTool>
        )}
        {ins.setSquare && (
          <PlacedTool kind="setSquare" p={ins.setSquare} onRotate={setRotating}>
            <SetSquareShape kind={ins.setSquare.kind} />
          </PlacedTool>
        )}
        {ins.protractor && (
          <PlacedTool kind="protractor" p={ins.protractor} onRotate={setRotating}>
            <ProtractorShape />
          </PlacedTool>
        )}
        {ins.compass && <Compass c={ins.compass} />}
        {rotating && (
          <text
            className="tb-ins-angle"
            x={(16 - view.x) / view.scale}
            y={(28 - view.y) / view.scale}
            fontSize={18 / view.scale}
          >
            {`${t(`instr.${rotating.kind}` as 'instr.ruler')}: ${Math.round(((rotating.angle % 360) + 360) % 360)}°`}
          </text>
        )}
      </g>
    </svg>
  );
}

/** מיקום הידית לסיבוב ומרכז הסיבוב לכל כלי (מקומי) */
const HANDLE: Record<Kind, { x: number; y: number }> = {
  ruler: { x: RULER.length / 2 + 22, y: 0 },
  protractor: { x: 0, y: -PROTRACTOR_R - 24 },
  setSquare: { x: 0, y: 26 },
};

function PlacedTool({
  kind,
  p,
  children,
  onRotate,
}: {
  kind: Kind;
  p: Placed;
  children: ReactNode;
  onRotate: (r: { kind: string; angle: number } | null) => void;
}) {
  const rt = useRuntime();
  const update = (patch: Partial<Placed>) =>
    rt.board.getState().setInstruments((i) => ({ ...i, [kind]: { ...i[kind]!, ...patch } }));
  const onMoveStart = (e: ReactPointerEvent) => {
    const start = toBoard(rt, e.clientX, e.clientY);
    const orig = { x: p.x, y: p.y };
    startDrag(e, (ev) => {
      const q = toBoard(rt, ev.clientX, ev.clientY);
      update({ x: orig.x + q.x - start.x, y: orig.y + q.y - start.y });
    });
  };
  const onRotateStart = (e: ReactPointerEvent) => {
    const h = HANDLE[kind];
    const offset = (Math.atan2(h.y, h.x) * 180) / Math.PI;
    startDrag(
      e,
      (ev) => {
        const q = toBoard(rt, ev.clientX, ev.clientY);
        let a = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI - offset;
        // Shift – קפיצות של 15°; אחרת מעלות שלמות
        a = ev.shiftKey ? Math.round(a / 15) * 15 : Math.round(a);
        update({ angle: a });
        onRotate({ kind, angle: a });
      },
      () => onRotate(null),
    );
  };
  const h = HANDLE[kind];
  return (
    <g transform={`translate(${p.x} ${p.y}) rotate(${p.angle})`} data-instrument={kind}>
      <g className="tb-ins-body" onPointerDown={onMoveStart}>
        {children}
      </g>
      <circle
        className="tb-ins-handle"
        cx={h.x}
        cy={h.y}
        r={11}
        data-instrument-rotate={kind}
        onPointerDown={onRotateStart}
      />
      <path
        className="tb-ins-handle-icon"
        d={`M${h.x - 5} ${h.y - 1} A5 5 0 1 1 ${h.x + 1} ${h.y + 5}`}
        pointerEvents="none"
      />
      <CloseButton kind={kind} x={h.x} y={h.y + (kind === 'ruler' ? 26 : -26)} />
    </g>
  );
}

function CloseButton({ kind, x, y }: { kind: keyof Instruments; x: number; y: number }) {
  const rt = useRuntime();
  return (
    <g
      className="tb-ins-close"
      onPointerDown={(e) => {
        e.stopPropagation();
        rt.board.getState().setInstruments((i) => {
          const next = { ...i };
          delete next[kind];
          return next;
        });
      }}
      data-instrument-close={kind}
    >
      <circle cx={x} cy={y} r={9} />
      <path
        d={`M${x - 3.5} ${y - 3.5}L${x + 3.5} ${y + 3.5}M${x + 3.5} ${y - 3.5}L${x - 3.5} ${y + 3.5}`}
      />
    </g>
  );
}

function RulerShape() {
  const L = RULER.length;
  const W = RULER.width;
  const x0 = -L / 2 + RULER.pad;
  const ticks: ReactNode[] = [];
  for (let mm = 0; mm <= 150; mm++) {
    const x = x0 + (mm * UNITS_PER_CM) / 10;
    const len = mm % 10 === 0 ? 16 : mm % 5 === 0 ? 11 : 6;
    ticks.push(<line key={mm} x1={x} y1={-W / 2} x2={x} y2={-W / 2 + len} />);
    if (mm % 10 === 0)
      ticks.push(
        <text key={`t${mm}`} x={x} y={-W / 2 + 30} textAnchor="middle">
          {mm / 10}
        </text>,
      );
  }
  return (
    <>
      <rect x={-L / 2} y={-W / 2} width={L} height={W} rx={4} className="tb-ins-fill" />
      <g className="tb-ins-ticks">{ticks}</g>
      <text x={L / 2 - 30} y={W / 2 - 10} className="tb-ins-unit" textAnchor="middle">
        cm
      </text>
    </>
  );
}

function ProtractorShape() {
  const R = PROTRACTOR_R;
  const ticks: ReactNode[] = [];
  for (let d = 0; d <= 180; d++) {
    const a = (-d * Math.PI) / 180;
    const len = d % 10 === 0 ? 16 : d % 5 === 0 ? 11 : 6;
    const cx = Math.cos(a);
    const sy = Math.sin(a);
    ticks.push(<line key={d} x1={cx * R} y1={sy * R} x2={cx * (R - len)} y2={sy * (R - len)} />);
    if (d % 10 === 0) {
      ticks.push(
        <text key={`o${d}`} x={cx * (R - 28)} y={sy * (R - 28) + 4} textAnchor="middle">
          {d}
        </text>,
        <text
          key={`i${d}`}
          x={cx * (R - 48)}
          y={sy * (R - 48) + 4}
          textAnchor="middle"
          className="tb-ins-inner"
        >
          {180 - d}
        </text>,
      );
    }
  }
  return (
    <>
      <path d={`M${-R} 0 A${R} ${R} 0 0 1 ${R} 0 Z`} className="tb-ins-fill" />
      <g className="tb-ins-ticks">{ticks}</g>
      <circle cx={0} cy={0} r={3} className="tb-ins-center" />
      <line x1={0} y1={0} x2={0} y2={-R * 0.25} className="tb-ins-ticks-line" />
    </>
  );
}

function SetSquareShape({ kind }: { kind: '45' | '60' }) {
  const c = setSquareCorners(kind);
  const ticks: ReactNode[] = [];
  const cm = Math.floor(c[1]!.x / UNITS_PER_CM);
  for (let i = 1; i <= cm; i++) {
    const x = i * UNITS_PER_CM;
    ticks.push(<line key={i} x1={x} y1={0} x2={x} y2={-10} />);
    ticks.push(
      <text key={`t${i}`} x={x} y={-14} textAnchor="middle">
        {i}
      </text>,
    );
  }
  return (
    <>
      <polygon points={c.map((p) => `${p.x},${p.y}`).join(' ')} className="tb-ins-fill" />
      <g className="tb-ins-ticks">{ticks}</g>
      <path d="M0 -14 L14 -14 L14 0" className="tb-ins-ticks-line" fill="none" />
    </>
  );
}

/** מחוגה: מחט (מרכז), עיפרון (רדיוס), וידית סיבוב שמציירת קשת בצבע העט */
function Compass({ c }: { c: CompassState }) {
  const rt = useRuntime();
  const [drawing, setDrawing] = useState<{ a0: number; sweep: number } | null>(null);
  const sweepRef = useRef(0);
  const set = (patch: Partial<CompassState>) =>
    rt.board.getState().setInstruments((i) => ({ ...i, compass: { ...i.compass!, ...patch } }));
  const rad = (c.angle * Math.PI) / 180;
  const px = c.cx + c.r * Math.cos(rad);
  const py = c.cy + c.r * Math.sin(rad);
  const knobD = 30;
  const kx = c.cx + (c.r + knobD) * Math.cos(rad);
  const ky = c.cy + (c.r + knobD) * Math.sin(rad);

  const onNeedle = (e: ReactPointerEvent) => {
    const start = toBoard(rt, e.clientX, e.clientY);
    const o = { x: c.cx, y: c.cy };
    startDrag(e, (ev) => {
      const q = toBoard(rt, ev.clientX, ev.clientY);
      set({ cx: o.x + q.x - start.x, cy: o.y + q.y - start.y });
    });
  };
  const onPencil = (e: ReactPointerEvent) =>
    startDrag(e, (ev) => {
      const q = toBoard(rt, ev.clientX, ev.clientY);
      set({
        r: Math.max(10, Math.hypot(q.x - c.cx, q.y - c.cy)),
        angle: (Math.atan2(q.y - c.cy, q.x - c.cx) * 180) / Math.PI,
      });
    });
  const onKnob = (e: ReactPointerEvent) => {
    const a0 = c.angle;
    let last = a0;
    sweepRef.current = 0;
    setDrawing({ a0, sweep: 0 });
    startDrag(
      e,
      (ev) => {
        const q = toBoard(rt, ev.clientX, ev.clientY);
        const a = unwrapAngle(last, (Math.atan2(q.y - c.cy, q.x - c.cx) * 180) / Math.PI);
        last = a;
        sweepRef.current = Math.max(-360, Math.min(360, a - a0));
        set({ angle: a });
        setDrawing({ a0, sweep: sweepRef.current });
      },
      () => {
        setDrawing(null);
        const sweep = sweepRef.current;
        if (Math.abs(sweep) < 1) return;
        // הקשת נשמרת כקו בעט (אפשר למחוק, לבטל, לייצא)
        const s = rt.board.getState();
        const cur = s.instruments.compass!;
        const pts = arcPoints(cur, a0, sweep);
        const ox = pts[0]!.x;
        const oy = pts[0]!.y;
        const ink: InkObject = {
          id: newId(),
          type: 'ink',
          transform: { ...IDENTITY_TRANSFORM, x: ox, y: oy },
          style: {
            kind: 'pen',
            color: s.prefs.pen.color,
            width: s.prefs.pen.width,
            opacity: s.prefs.pen.opacity,
          },
          points: pts.flatMap((p) => [
            Math.round((p.x - ox) * 100) / 100,
            Math.round((p.y - oy) * 100) / 100,
            0.5,
          ]),
          pressure: false,
        };
        s.commit('compass', [{ type: 'add', pageId: s.pageId, objects: [ink] }]);
      },
    );
  };

  const preview =
    drawing && Math.abs(drawing.sweep) >= 1 ? arcPoints(c, drawing.a0, drawing.sweep) : null;
  return (
    <g data-instrument="compass">
      {preview && (
        <polyline
          points={preview.map((p) => `${p.x},${p.y}`).join(' ')}
          className="tb-ins-arc"
          style={{ stroke: rt.board.getState().prefs.pen.color }}
        />
      )}
      <circle cx={c.cx} cy={c.cy} r={c.r} className="tb-ins-guide" />
      <line x1={c.cx} y1={c.cy} x2={kx} y2={ky} className="tb-ins-arm" />
      <circle
        cx={c.cx}
        cy={c.cy}
        r={9}
        className="tb-ins-needle"
        onPointerDown={onNeedle}
        data-compass="needle"
      />
      <circle
        cx={px}
        cy={py}
        r={9}
        className="tb-ins-pencil"
        onPointerDown={onPencil}
        data-compass="pencil"
      />
      <circle
        cx={kx}
        cy={ky}
        r={12}
        className="tb-ins-handle"
        onPointerDown={onKnob}
        data-compass="knob"
      />
      <text
        x={(c.cx + px) / 2}
        y={(c.cy + py) / 2 - 8}
        className="tb-ins-radius"
        textAnchor="middle"
      >
        {`r = ${(c.r / UNITS_PER_CM).toFixed(1)}`}
      </text>
      <CloseButton kind="compass" x={c.cx} y={c.cy + 26} />
    </g>
  );
}

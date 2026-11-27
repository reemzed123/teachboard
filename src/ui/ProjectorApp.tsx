import { useEffect, useRef, useState } from 'react';
import { Maximize } from 'lucide-react';
import type { BoardDocument, InkObject } from '../core/document/types';
import type { Instruments } from '../core/instruments';
import { displayMs, formatClock, isFinished } from '../core/teaching/timer';
import { BoardEngine } from '../engine/BoardEngine';
import { drawObjectLocal, setObjectImageSource } from '../engine/render/drawObject';
import { createBoardStore, type ViewState } from '../features/board/boardStore';
import { AssetCache } from '../features/lessons/assetCache';
import {
  PROJECTOR_CHANNEL,
  type ProjectorMessage,
  type TeachingMirror,
} from '../features/projector/protocol';
import { createWebLessonRepository } from '../platform/web/lessonRepository';
import { t } from '../i18n';
import { RuntimeContext } from '../app/StoreContext';
import type { AppRuntime } from '../app/runtime';
import { InstrumentsOverlay } from './InstrumentsOverlay';

// מסך המקרן: רק הלוח, בלי סרגלים וחלוניות. עוקב אחרי מה שהמורה רואה וכותב.
// לא ניתן לכתוב בו (צפייה בלבד), והוא לא משנה שום דבר בשיעור.

const noStorage = { load: () => null, save: () => true };

export function ProjectorApp() {
  const hostRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLCanvasElement>(null);
  const [teaching, setTeaching] = useState<TeachingMirror | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);
  const [laser, setLaser] = useState(false);
  const [view, setView] = useState<ViewState>({ x: 0, y: 0, scale: 1 });
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [, setInstruments] = useState<Instruments>({});
  // מצב התצוגה של המקרן (נוצר פעם אחת)
  const [store] = useState(() => {
    const st = createBoardStore(noStorage);
    st.getState().setTool('hand');
    return st;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const repo = createWebLessonRepository();
    const assets = new AssetCache(repo);
    setObjectImageSource(assets);
    const engine = new BoardEngine(host, store, assets);
    let live: InkObject | null = null;
    let visible = { x: 0, y: 0, width: 800, height: 600 };

    /** מתאימים את התצוגה כך שהאזור שהמורה רואה ייכנס כולו */
    const fit = () => {
      const w = host.clientWidth || 1;
      const h = host.clientHeight || 1;
      const scale = Math.min(w / visible.width, h / visible.height);
      const v = {
        scale,
        x: w / 2 - (visible.x + visible.width / 2) * scale,
        y: h / 2 - (visible.y + visible.height / 2) * scale,
      };
      store.getState().setView(v);
      setView(v);
      drawLive();
    };
    const drawLive = () => {
      const c = liveRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      c.width = host.clientWidth * dpr;
      c.height = host.clientHeight * dpr;
      const ctx = c.getContext('2d')!;
      ctx.clearRect(0, 0, c.width, c.height);
      if (!live) return;
      const v = store.getState().view;
      ctx.setTransform(
        dpr * v.scale,
        0,
        0,
        dpr * v.scale,
        dpr * (v.x + live.transform.x * v.scale),
        dpr * (v.y + live.transform.y * v.scale),
      );
      ctx.globalAlpha = live.style.opacity;
      drawObjectLocal(ctx, live);
    };

    const ch = new BroadcastChannel(PROJECTOR_CHANNEL);
    ch.onmessage = (e: MessageEvent<ProjectorMessage>) => {
      const m = e.data;
      if (m.type === 'doc') {
        setConnected(true);
        store.setState({ doc: m.doc as BoardDocument, pageId: m.pageId });
        const page = m.doc.pages.find((p) => p.id === m.pageId);
        host.dataset.objectCount = String(page?.objects.length ?? 0);
        host.dataset.pageId = m.pageId;
      } else if (m.type === 'view') {
        setConnected(true);
        if (store.getState().pageId !== m.pageId) store.setState({ pageId: m.pageId });
        host.dataset.pageId = m.pageId;
        visible = m.visible;
        store.getState().setInstruments(() => m.instruments);
        setInstruments(m.instruments);
        setTeaching(m.teaching);
        setLaser(m.laser);
        fit();
      } else if (m.type === 'pointer') {
        setPointer(m.pointer);
        live = m.live;
        host.dataset.live = m.live ? 'on' : 'off';
        drawLive();
      } else if (m.type === 'bye') {
        setConnected(false);
      }
    };
    ch.postMessage({ type: 'hello' } satisfies ProjectorMessage);
    const ro = new ResizeObserver(fit);
    ro.observe(host);
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => {
      clearInterval(tick);
      ro.disconnect();
      ch.close();
      engine.destroy();
    };
  }, [store]);

  const screen = (p: { x: number; y: number }) => ({
    x: p.x * view.scale + view.x,
    y: p.y * view.scale + view.y,
  });
  const sp = teaching?.spotlight.on && pointer ? screen(pointer) : null;
  const clock = teaching?.clock;

  return (
    <div className="tb-projector" data-testid="projector" data-connected={connected || undefined}>
      <div ref={hostRef} className="tb-board tb-projector-board" data-testid="board" />
      <canvas ref={liveRef} className="tb-projector-live" />
      {/* הסרגל/המחוגה של המורה – לתצוגה בלבד */}
      <RuntimeContext.Provider value={{ board: store } as unknown as AppRuntime}>
        <div className="tb-projector-instruments">
          <InstrumentsOverlay />
        </div>
      </RuntimeContext.Provider>
      {teaching?.cover.on && (
        <div
          className="tb-cover"
          data-side={teaching.cover.side}
          style={
            teaching.cover.side === 'left' || teaching.cover.side === 'right'
              ? { width: `${teaching.cover.amount * 100}%` }
              : { height: `${teaching.cover.amount * 100}%` }
          }
        />
      )}
      {teaching?.spotlight.on && (
        <div
          className="tb-spotlight"
          style={
            {
              '--tb-spot-r': `${teaching.spotlight.radius * (view.scale || 1)}px`,
              '--tb-spot-x': sp ? `${sp.x}px` : '50%',
              '--tb-spot-y': sp ? `${sp.y}px` : '50%',
            } as React.CSSProperties
          }
        />
      )}
      {laser && pointer && (
        <div
          className="tb-projector-laser"
          data-testid="projector-laser"
          style={{ left: screen(pointer).x, top: screen(pointer).y }}
        />
      )}
      {clock && (
        <div
          className="tb-clock tb-projector-clock"
          data-finished={isFinished(clock, now) || undefined}
        >
          <div className="tb-clock-time" dir="ltr">
            {isFinished(clock, now)
              ? t('teaching.timeUp')
              : formatClock(displayMs(clock, now), clock.mode)}
          </div>
        </div>
      )}
      {!connected && <p className="tb-projector-wait">{t('projector.waiting')}</p>}
      <button
        type="button"
        className="tb-projector-full"
        onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}
        aria-label={t('projector.fullscreen')}
        title={t('projector.fullscreen')}
      >
        <Maximize size={20} />
      </button>
    </div>
  );
}

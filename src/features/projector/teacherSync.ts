import type { AppRuntime } from '../../app/runtime';
import { visibleBoardRect } from '../../engine/viewport';
import { getLiveInk, onLiveInk } from '../../engine/liveInk';
import { PROJECTOR_CHANNEL, type ProjectorMessage } from './protocol';

/**
 * צד המורה: משדר למסך המקרן את המסמך, התצוגה, כלי ההוראה והכתיבה בזמן אמת.
 * משדר רק אחרי שמקרן אמר "שלום" (בלי מקרן – לא נשלח כלום).
 */
export function installTeacherSync(rt: AppRuntime): () => void {
  if (typeof BroadcastChannel === 'undefined') return () => {};
  const ch = new BroadcastChannel(PROJECTOR_CHANNEL);
  let active = false;
  let pointer: { x: number; y: number } | null = null;
  let frame = 0;

  const host = () => document.querySelector('[data-testid=board]') as HTMLElement | null;
  const post = (m: ProjectorMessage) => ch.postMessage(m);
  const sendDoc = () => {
    const s = rt.board.getState();
    post({ type: 'doc', doc: s.doc, pageId: s.pageId });
  };
  const sendView = () => {
    const s = rt.board.getState();
    const h = host();
    const t = rt.teaching.getState();
    post({
      type: 'view',
      pageId: s.pageId,
      visible: visibleBoardRect(s.view, h?.clientWidth ?? 800, h?.clientHeight ?? 600),
      instruments: s.instruments,
      teaching: { spotlight: t.spotlight, cover: t.cover, clock: t.clock },
      laser: s.tool === 'laser',
    });
  };
  /** מיקום וכתיבה – לכל היותר פעם בפריים */
  const schedulePointer = () => {
    if (!active || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      post({ type: 'pointer', pointer, live: getLiveInk() });
    });
  };

  ch.onmessage = (e: MessageEvent<ProjectorMessage>) => {
    if (e.data?.type !== 'hello') return;
    active = true;
    sendDoc();
    sendView();
  };
  const unsubBoard = rt.board.subscribe((s, prev) => {
    if (!active) return;
    if (s.doc !== prev.doc || s.pageId !== prev.pageId) sendDoc();
    if (
      s.view !== prev.view ||
      s.pageId !== prev.pageId ||
      s.instruments !== prev.instruments ||
      s.tool !== prev.tool
    )
      sendView();
  });
  const unsubTeach = rt.teaching.subscribe(() => active && sendView());
  const unsubLive = onLiveInk(schedulePointer);
  const onMove = (e: PointerEvent) => {
    const h = host();
    if (!h) return;
    const r = h.getBoundingClientRect();
    const v = rt.board.getState().view;
    pointer = { x: (e.clientX - r.left - v.x) / v.scale, y: (e.clientY - r.top - v.y) / v.scale };
    schedulePointer();
  };
  const onLeave = () => {
    pointer = null;
    schedulePointer();
  };
  window.addEventListener('pointermove', onMove, { passive: true });
  document.addEventListener('pointerleave', onLeave);
  // גם הזזה/זום חיים (לפני שהתצוגה נשמרת) – שולחים בסוף
  const onResize = () => active && sendView();
  window.addEventListener('resize', onResize);
  const onUnload = () => post({ type: 'bye' });
  window.addEventListener('pagehide', onUnload);

  return () => {
    unsubBoard();
    unsubTeach();
    unsubLive();
    window.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pagehide', onUnload);
    cancelAnimationFrame(frame);
    ch.close();
  };
}

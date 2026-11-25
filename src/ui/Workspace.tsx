import { useEffect, useRef } from 'react';
import { useRuntime } from '../app/StoreContext';
import { currentPage } from '../features/board/boardStore';
import { BoardEngine } from '../engine/BoardEngine';
import { t } from '../i18n';
import { installDebugHooks } from '../app/debug';
import { attachEngine } from '../app/runtime';
import { PageStrip } from './PageStrip';
import { ZoomControls } from './ZoomControls';

export function Workspace() {
  const rt = useRuntime();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const engine = new BoardEngine(host, rt.board, rt.assets);
    attachEngine(rt, engine);

    // מספר האובייקטים בלוח – לבדיקות אוטומטיות.
    const updateCount = () => {
      host.dataset.objectCount = String(currentPage(rt.board.getState()).objects.length);
    };
    updateCount();
    const unsub = rt.board.subscribe(
      (s, prev) => (s.doc !== prev.doc || s.pageId !== prev.pageId) && updateCount(),
    );
    const removeDebug = installDebugHooks(rt);

    // סגירה אוטומטית של החלונית כשמתחילים לכתוב/למחוק/לבחור על הלוח (לא בהזזה/זום).
    const onBoardPointerDown = (e: PointerEvent) => {
      const app = rt.app.getState();
      if (!app.settings.autoClosePanel || !app.openPanel) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (rt.board.getState().tool === 'hand') return;
      app.closePanel();
    };
    host.addEventListener('pointerdown', onBoardPointerDown);

    return () => {
      unsub();
      removeDebug();
      host.removeEventListener('pointerdown', onBoardPointerDown);
      engine.destroy();
      if (rt.engine === engine) attachEngine(rt, null);
    };
  }, [rt]);

  return (
    <main className="tb-workspace" aria-label={t('workspace.label')}>
      <div ref={hostRef} className="tb-board" data-testid="board" />
      <PageStrip />
      <ZoomControls />
    </main>
  );
}

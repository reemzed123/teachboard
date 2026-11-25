import { useEffect, useRef } from 'react';
import { useRuntime } from '../app/StoreContext';
import { currentPage } from '../features/board/boardStore';
import { BoardEngine } from '../engine/BoardEngine';
import { t } from '../i18n';
import { installDebugHooks } from '../app/debug';
import { attachEngine } from '../app/runtime';
import { ZoomControls } from './ZoomControls';

export function Workspace() {
  const rt = useRuntime();
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const engine = new BoardEngine(host, rt.board);
    attachEngine(rt, engine);

    // מספר האובייקטים בלוח – לבדיקות אוטומטיות.
    const updateCount = () => {
      host.dataset.objectCount = String(currentPage(rt.board.getState()).objects.length);
    };
    updateCount();
    const unsub = rt.board.subscribe((s, prev) => s.doc !== prev.doc && updateCount());
    const removeDebug = installDebugHooks(rt);

    return () => {
      unsub();
      removeDebug();
      engine.destroy();
      if (rt.engine === engine) attachEngine(rt, null);
    };
  }, [rt]);

  return (
    <main className="tb-workspace" aria-label={t('workspace.label')}>
      <div ref={hostRef} className="tb-board" data-testid="board" />
      <ZoomControls />
    </main>
  );
}

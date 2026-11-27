import { useEffect, useRef } from 'react';
import { useRuntime } from '../app/StoreContext';
import { currentPage } from '../features/board/boardStore';
import { BoardEngine } from '../engine/BoardEngine';
import { t } from '../i18n';
import { installDebugHooks } from '../app/debug';
import { attachEngine } from '../app/runtime';
import { PageStrip } from './PageStrip';
import { ErrorBoundary } from './ErrorBoundary';
import { SelectionToolbar } from './SelectionToolbar';
import { GeoCircleBar } from './GeoCircleBar';
import { GeoLabelEditor } from './GeoLabelEditor';
import { QuickRadialMenu } from './QuickRadialMenu';
import { TextEditor } from './TextEditor';
import { ZoomControls } from './ZoomControls';
import { Spotlight } from './teaching/Spotlight';
import { Cover } from './teaching/Cover';
import { ClockWidget } from './teaching/ClockWidget';

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
      const board = rt.board.getState();
      // הזזת הלוח לא סוגרת (רק מסתכלים)
      if (board.tool === 'hand') return;
      // גיאומטריה, "בחירה והזזה": בחירת אלמנט משאירה את החלונית – שם המאפיינים שלו.
      // לחיצה במקום ריק – נסגרת.
      if (board.tool === 'geometry' && board.prefs.geo.tool === 'move') {
        setTimeout(() => {
          if (!rt.board.getState().geoSelection) rt.app.getState().closePanel();
        }, 0);
        return;
      }
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
      <ErrorBoundary fallback={() => null}>
        <Cover />
        <Spotlight />
        <ClockWidget />
      </ErrorBoundary>
      <ErrorBoundary fallback={() => null}>
        <TextEditor />
      </ErrorBoundary>
      <ErrorBoundary fallback={() => null}>
        <SelectionToolbar />
        <GeoCircleBar />
        <GeoLabelEditor />
        <QuickRadialMenu />
      </ErrorBoundary>
      <ErrorBoundary fallback={() => null}>
        <PageStrip />
      </ErrorBoundary>
      <ZoomControls />
    </main>
  );
}

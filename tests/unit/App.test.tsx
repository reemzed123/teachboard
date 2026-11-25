import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

// מנוע הציור צריך Canvas אמיתי – הוא נבדק בדפדפן (Playwright). כאן מחליפים אותו בדמה.
vi.mock('../../src/engine/BoardEngine', () => ({
  BoardEngine: class {
    zoomBy() {}
    zoomTo() {}
    fitContent() {}
    destroy() {}
  },
}));

import { App } from '../../src/app/App';
import { RuntimeContext } from '../../src/app/StoreContext';
import { createTestRuntime } from './helpers';

afterEach(cleanup);

function renderApp() {
  const rt = createTestRuntime();
  render(
    <RuntimeContext.Provider value={rt}>
      <App />
    </RuntimeContext.Provider>,
  );
  return rt;
}

describe('App', () => {
  it('renders the top bar, categories and workspace', () => {
    renderApp();
    expect(screen.getByText('TeachBoard')).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'קטגוריות כלים' })).toBeTruthy();
    expect(screen.getByRole('main', { name: 'אזור העבודה' })).toBeTruthy();
  });

  it('every button has a label (tooltip)', () => {
    renderApp();
    for (const b of screen.getAllByRole('button')) {
      expect(b.getAttribute('aria-label') || b.textContent).toBeTruthy();
    }
  });

  it('category button opens and closes its panel', () => {
    renderApp();
    const btn = screen.getByRole('button', { name: 'מתמטיקה' });
    fireEvent.click(btn);
    expect(screen.getByRole('complementary', { name: 'מתמטיקה' })).toBeTruthy();
    fireEvent.click(btn);
    expect(screen.queryByRole('complementary', { name: 'מתמטיקה' })).toBeNull();
  });

  it('drawing panel shows real tools', () => {
    const rt = renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'ציור וכתיבה' }));
    fireEvent.click(screen.getByRole('radio', { name: /מחק/ }));
    expect(rt.board.getState().tool).toBe('eraser');
    expect(screen.getByText('סוג מחיקה')).toBeTruthy();
  });

  it('keyboard shortcuts switch tools, also with a Hebrew keyboard layout', () => {
    const rt = renderApp();
    fireEvent.keyDown(window, { key: 'ק', code: 'KeyE' });
    expect(rt.board.getState().tool).toBe('eraser');
    fireEvent.keyDown(window, { key: 'ה', code: 'KeyV' });
    expect(rt.board.getState().tool).toBe('select');
  });

  it('Escape closes the panel', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'הגדרות' }));
    expect(screen.getByRole('complementary', { name: 'הגדרות' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'הגדרות' })).toBeNull();
  });
});

describe('shortcuts and focus', () => {
  it('Ctrl+Z works after clicking an option in the panel, but not while typing text', () => {
    const rt = renderApp();
    const s = rt.board.getState();
    s.commit('draw', [
      {
        type: 'add',
        pageId: s.pageId,
        objects: [
          {
            id: 'a',
            type: 'ink',
            transform: { x: 0, y: 0, rotation: 0, scale: 1 },
            style: { kind: 'pen', color: '#000000', width: 4, opacity: 1 },
            points: [0, 0, 0.5],
            pressure: false,
          },
        ],
      },
    ]);
    const text = document.createElement('input');
    document.body.append(text);
    fireEvent.keyDown(text, { key: 'z', code: 'KeyZ', ctrlKey: true });
    expect(rt.board.getState().history.past).toHaveLength(1);

    const radio = document.createElement('input');
    radio.type = 'radio';
    document.body.append(radio);
    fireEvent.keyDown(radio, { key: 'z', code: 'KeyZ', ctrlKey: true });
    expect(rt.board.getState().history.past).toHaveLength(0);
    text.remove();
    radio.remove();
  });
});

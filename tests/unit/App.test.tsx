import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../../src/app/App';
import { createAppStore } from '../../src/app/store';
import { StoreContext } from '../../src/app/StoreContext';

function renderApp() {
  const store = createAppStore({ load: () => null, save: () => true });
  render(
    <StoreContext.Provider value={store}>
      <App />
    </StoreContext.Provider>,
  );
  return store;
}

afterEach(cleanup);

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

  it('Escape closes the panel', () => {
    renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'הגדרות' }));
    expect(screen.getByRole('complementary', { name: 'הגדרות' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: 'הגדרות' })).toBeNull();
  });
});

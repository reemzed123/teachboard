import { describe, expect, it } from 'vitest';
import { installPageZoomGuard } from '../../src/app/pageZoomGuard';

describe('pageZoomGuard', () => {
  it('blocks ctrl+wheel and ctrl+=/-/0 (whole-UI zoom) but not plain wheel or keys', () => {
    const off = installPageZoomGuard(window);
    const wheel = (ctrlKey: boolean) => {
      const e = new WheelEvent('wheel', { deltaY: 5, ctrlKey, cancelable: true, bubbles: true });
      document.body.dispatchEvent(e);
      return e.defaultPrevented;
    };
    const key = (code: string, ctrlKey: boolean) => {
      const e = new KeyboardEvent('keydown', { code, ctrlKey, cancelable: true, bubbles: true });
      document.body.dispatchEvent(e);
      return e.defaultPrevented;
    };
    expect(wheel(true)).toBe(true);
    expect(wheel(false)).toBe(false);
    expect(key('Equal', true)).toBe(true);
    expect(key('Digit0', true)).toBe(true);
    expect(key('Equal', false)).toBe(false);
    expect(key('KeyC', true)).toBe(false);
    off();
    expect(wheel(true)).toBe(false);
  });
});

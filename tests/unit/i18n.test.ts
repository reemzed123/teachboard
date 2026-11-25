import { describe, expect, it } from 'vitest';
import { getDirection, setLocale, t } from '../../src/i18n';

describe('i18n', () => {
  it('sets Hebrew with RTL direction on the document', () => {
    setLocale('he');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('he');
    expect(getDirection()).toBe('rtl');
  });

  it('returns translated text', () => {
    expect(t('app.name')).toBe('TeachBoard');
  });
});

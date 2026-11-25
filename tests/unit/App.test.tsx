import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../../src/app/App';

describe('App', () => {
  it('renders the app name', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'TeachBoard' })).toBeTruthy();
  });

  it('shows no buttons before they are implemented', () => {
    render(<App />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});

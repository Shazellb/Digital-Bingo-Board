import { describe, expect, it } from 'vitest';
import { formatBuildLabel, injectBuildLabels } from './version';

const TEST_BUILD = { commit: 'abcdef123456', date: '2026-09-15' };

describe('build version label', () => {
  it('formats a short commit and build date', () => {
    expect(formatBuildLabel(TEST_BUILD)).toBe('Build abcdef1 · 2026-09-15');
  });

  it('injects the version into every labelled element', () => {
    document.body.innerHTML = '<span data-build-label></span><small data-build-label></small>';

    injectBuildLabels(document, TEST_BUILD);

    for (const element of document.querySelectorAll<HTMLElement>('[data-build-label]')) {
      expect(element.textContent).toBe('Build abcdef1 · 2026-09-15');
      expect(element.title).toBe('Digital Bingo Board Build abcdef1 · 2026-09-15');
    }
  });
});

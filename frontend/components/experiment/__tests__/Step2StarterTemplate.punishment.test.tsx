/**
 * Tests for Step2StarterTemplate punishment configuration UI.
 *
 * Tests for:
 * - Punishment section rendering when scenario is PUBLIC_GOODS
 * - Budget, cost ratio, and anonymous mode inputs
 * - Collapsible section behavior
 *
 * Wave 0 scaffold - tests use it.todo() for Wave 1 implementation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { I18nextProvider } from 'react-i18next';

// Mock i18next
const i18n = {
  language: 'en',
  changeLanguage: vi.fn(),
  t: (key: string) => key,
} as any;

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

// Mock the store - will be properly configured in Wave 1
vi.mock('@/store/experiment-builder', () => ({
  useExperimentBuilder: vi.fn(),
}));

describe('Step2StarterTemplate - Punishment Configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Wave 0: Punishment UI Test Scaffolds (FEAT-PGG-05 through FEAT-PGG-08)
  // =========================================================================

  describe('Punishment Section Rendering', () => {
    it.todo('should render punishment section when scenario is PUBLIC_GOODS');
    it.todo('should show budget input with default 0');
    it.todo('should show cost ratio input with default 3.0');
    it.todo('should show anonymous mode toggle');
    it.todo('should have punishment section collapsed by default');
    it.todo('should expand punishment section on click');
  });
});

import { render, screen } from '@testing-library/react';
import IosAddToHomeScreen from './IosAddToHomeScreen';

describe('IosAddToHomeScreen', () => {
  const originalUserAgent = window.navigator.userAgent;
  const originalStandalone = window.navigator.standalone;
  const originalPlatform = window.navigator.platform;

  beforeEach(() => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'standalone', {
      value: false,
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'platform', {
      value: 'iPhone',
      configurable: true,
    });
    document.body.className = '';
    document.documentElement.className = '';
    window.localStorage.clear();
  });

  afterAll(() => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: originalUserAgent,
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'standalone', {
      value: originalStandalone,
      configurable: true,
    });
    Object.defineProperty(window.navigator, 'platform', {
      value: originalPlatform,
      configurable: true,
    });
  });

  test('locks page scrolling when the iOS install prompt is visible', () => {
    render(<IosAddToHomeScreen />);

    expect(screen.getByRole('dialog', { name: 'Install Connect' })).toBeInTheDocument();
    expect(document.body.classList.contains('ios-a2hs-scroll-locked')).toBe(true);
    expect(document.documentElement.classList.contains('ios-a2hs-scroll-locked')).toBe(true);
  });
});

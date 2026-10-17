import '@testing-library/jest-dom';
import { afterEach } from 'vitest';

declare global {
  interface Window {
    localStorage: Storage;
  }
  interface ScrollToOptions {
    left?: number;
    top?: number;
  }
}

// Under vmThreads every test file in a worker shares happy-dom's element
// classes, so a scrollIntoView stub written on Element/HTMLElement.prototype
// leaks into every file that runs after it: a plain assignment in the next
// file throws when the stub is non-writable, and a mock set on
// Element.prototype is shadowed when the previous file wrote an own property
// on HTMLElement.prototype. Re-pin both prototypes to a pristine no-op before
// each file and after each test. happy-dom's own implementation is a no-op
// too (Element.js), so nothing is lost.
const noopScrollIntoView = () => {};

export function resetScrollIntoViewPrototypes(): void {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    configurable: true,
    writable: true,
    value: noopScrollIntoView,
  });
  delete (HTMLElement.prototype as unknown as { scrollIntoView?: unknown }).scrollIntoView;
}

resetScrollIntoViewPrototypes();
afterEach(resetScrollIntoViewPrototypes);

if (!window.localStorage) {
  const store: Record<string, string> = {};
  window.localStorage = {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach(key => delete store[key]); },
    key: (index: number) => Object.keys(store)[index] || null,
    length: Object.keys(store).length,
  };
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
  } as MediaQueryList);
}

if (!global.ResizeObserver) {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

if (!Element.prototype.scrollTo) {
  Element.prototype.scrollTo = function (optionsOrX?: ScrollToOptions | number, y?: number) {
    if (typeof optionsOrX === 'number' && typeof y === 'number') {
      this.scrollLeft = optionsOrX;
      this.scrollTop = y;
    } else if (optionsOrX && typeof optionsOrX === 'object') {
      const options = optionsOrX as ScrollToOptions;
      if (options.left !== undefined) this.scrollLeft = options.left;
      if (options.top !== undefined) this.scrollTop = options.top;
    }
  };
}

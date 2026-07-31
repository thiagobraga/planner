import '@testing-library/jest-dom';

declare global {
  interface Window {
    localStorage: Storage;
  }
  interface ScrollToOptions {
    left?: number;
    top?: number;
  }
}

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

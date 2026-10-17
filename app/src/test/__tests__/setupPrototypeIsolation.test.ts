import { describe, it, expect } from 'vitest';
import { resetScrollIntoViewPrototypes } from '../setup';

// Under vmThreads happy-dom's element classes are shared by every test file in
// a worker, so a scrollIntoView stub written on a prototype leaks into the
// files that run after it. DailyPage.behavior/dateFormat used to define a
// non-writable stub in beforeEach, which made the next file's plain assignment
// throw and HelpPage's Element.prototype mock get shadowed by the leaked own
// property on HTMLElement.prototype. setup.ts re-pins both prototypes; this
// test reproduces the leak and proves the reset erases it.
describe('scrollIntoView prototype isolation', () => {
  it('erases a non-writable stub leaked onto HTMLElement.prototype', () => {
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: () => {},
    });
    expect(Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')?.writable).toBe(false);

    resetScrollIntoViewPrototypes();

    expect(Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollIntoView')).toBeUndefined();
    expect(() => {
      HTMLElement.prototype.scrollIntoView = () => {};
    }).not.toThrow();
  });

  it('restores a stubbed Element.prototype.scrollIntoView to a plain writable no-op', () => {
    Element.prototype.scrollIntoView = () => {};
    expect(Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')?.writable).toBe(true);

    resetScrollIntoViewPrototypes();

    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
    expect(descriptor?.writable).toBe(true);
    expect(typeof descriptor?.value).toBe('function');
  });
});

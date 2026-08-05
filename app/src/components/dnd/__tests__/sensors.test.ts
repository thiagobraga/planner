import { describe, it, expect } from 'vitest';
import { PlannerPointerSensor, NO_DRAG_ATTR, DRAG_HANDLE_ATTR } from '../sensors';

const handler = PlannerPointerSensor.activators[0].handler;

function fire(target: HTMLElement, overrides: Partial<PointerEvent> = {}): boolean {
  const event = {
    isPrimary: true,
    button: 0,
    pointerType: 'mouse',
    target,
    ...overrides,
  } as unknown as PointerEvent;
  return handler({ nativeEvent: event } as never);
}

function elementWithAttr(attr: string): HTMLElement {
  const wrapper = document.createElement('div');
  const inner = document.createElement('span');
  inner.setAttribute(attr, '');
  wrapper.appendChild(inner);
  return inner;
}

describe('PlannerPointerSensor activator', () => {
  it('starts a mouse drag from anywhere on the row', () => {
    expect(fire(document.createElement('div'), { pointerType: 'mouse' })).toBe(true);
  });

  it('rejects a non-primary pointer', () => {
    expect(fire(document.createElement('div'), { pointerType: 'mouse', isPrimary: false })).toBe(false);
  });

  it('rejects a non-left mouse button (right-click opens the context menu instead)', () => {
    expect(fire(document.createElement('div'), { pointerType: 'mouse', button: 2 })).toBe(false);
  });

  it('rejects any pointer type inside a data-no-drag subtree', () => {
    const el = elementWithAttr(NO_DRAG_ATTR);
    expect(fire(el, { pointerType: 'mouse' })).toBe(false);
    expect(fire(el, { pointerType: 'touch' })).toBe(false);
  });

  it('starts a touch drag from anywhere on the row (non no-drag)', () => {
    expect(fire(document.createElement('div'), { pointerType: 'touch' })).toBe(true);
  });

  it('starts a pen drag from anywhere on the row (non no-drag)', () => {
    expect(fire(document.createElement('div'), { pointerType: 'pen' })).toBe(true);
  });
});

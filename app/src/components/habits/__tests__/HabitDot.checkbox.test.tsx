import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { HabitDot } from '../HabitDot';
import { useCheckboxStore } from '../../../stores/checkboxStore';

describe('HabitDot checkbox setting', () => {
  afterEach(() => act(() => useCheckboxStore.setState({ enabled: false })));

  it('draws the dot by default', () => {
    const { container } = render(<HabitDot state="full" />);
    expect(container.querySelector('.habit-dot-full')).not.toBeNull();
  });

  it.each(['empty', 'half', 'full'] as const)('draws a checkbox for %s when enabled', (state) => {
    act(() => useCheckboxStore.setState({ enabled: true }));
    const { container } = render(<HabitDot state={state} />);
    expect(container.querySelector('.habit-dot-checkbox')).not.toBeNull();
    expect(container.querySelector('.ui-checkbox-icon') !== null).toBe(state !== 'empty');
  });
});

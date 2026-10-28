import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { PlaceholderBullet } from '../PlaceholderBullet';
import { useCheckboxStore } from '../../../stores/checkboxStore';

describe('PlaceholderBullet', () => {
  afterEach(() => act(() => useCheckboxStore.setState({ enabled: false })));

  it('shows a bullet by default', () => {
    const { container } = render(<PlaceholderBullet />);
    expect(container).toHaveTextContent('•');
    expect(container.querySelector('.ui-checkbox-mark')).toBeNull();
  });

  it('shows an empty checkbox when enabled', () => {
    act(() => useCheckboxStore.setState({ enabled: true }));
    const { container } = render(<PlaceholderBullet />);
    expect(container.querySelector('.ui-checkbox-mark')).not.toBeNull();
    expect(container).not.toHaveTextContent('•');
  });
});

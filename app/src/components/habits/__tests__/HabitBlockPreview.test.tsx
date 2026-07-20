import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HabitBlockPreview } from '../HabitBlockPreview';

describe('HabitBlockPreview', () => {
  it('renders a habit name without a count when nothing is carried', () => {
    const { container } = render(
      <HabitBlockPreview name="Drink water" count={0} kind="habit" />,
    );

    expect(screen.getByText('Drink water')).toBeInTheDocument();
    expect(container.querySelector('.habit-timeline-row-color-dot')).toBeInTheDocument();
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });

  it('counts the sub-habits travelling with a habit', () => {
    render(<HabitBlockPreview name="Drink water" count={2} kind="habit" />);

    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('renders a group as a heading rather than a row', () => {
    const { container } = render(
      <HabitBlockPreview name="Morning" count={3} kind="habit-group" />,
    );

    const name = screen.getByText('Morning');
    expect(name.className).toContain('uppercase');
    expect(container.querySelector('.habit-timeline-row-color-dot')).not.toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
  });
});

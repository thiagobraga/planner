import { screen } from '@testing-library/react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router';
import { describe, expect, it } from 'vitest';
import { createdTask, renderWithProviders, sampleTasks } from './render';

function Probe() {
  const client = useQueryClient();
  const location = useLocation();
  return <span>{`${location.pathname}:${client.getDefaultOptions().queries?.retry}`}</span>;
}

describe('test render helpers', () => {
  it('provides a fresh query client and memory route', () => {
    renderWithProviders(<Probe />, undefined, ['/inbox']);
    expect(screen.getByText('/inbox:false')).toBeInTheDocument();
  });

  it('builds tasks with deterministic defaults and overrides', () => {
    expect(sampleTasks).toHaveLength(2);
    expect(createdTask({ title: 'Review plan' })).toMatchObject({
      id: 'created-1',
      title: 'Review plan',
      type: 'task',
    });
  });
});

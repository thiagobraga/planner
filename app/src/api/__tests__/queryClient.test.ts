import { describe, it, expect } from 'vitest';
import { queryClient } from '../queryClient';

describe('queryClient', () => {
  it('has staleTime of 60000ms', () => {
    expect(queryClient.getDefaultOptions().queries?.staleTime).toBe(60000);
  });

  it('has retry of 1', () => {
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(1);
  });
});

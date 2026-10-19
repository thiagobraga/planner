import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

describe('application destinations', () => {
  it('defaults to the hosted Planner registration', async () => {
    vi.stubEnv('VITE_APP_URL', '');
    const config = await import('./config');
    expect(config.REGISTER_URL).toBe('https://planner.thiagobraga.dev/register');
  });

  it('uses the configured application without duplicate trailing slashes', async () => {
    vi.stubEnv('VITE_APP_URL', 'https://planner.example.test///');
    const config = await import('./config');
    expect(config.REGISTER_URL).toBe('https://planner.example.test/register');
  });
});

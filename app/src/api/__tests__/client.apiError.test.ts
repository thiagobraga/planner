import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ApiError,
  request,
  apiRegister,
  apiRequestPasswordReset,
  apiConfirmPasswordReset,
  setCurrentUserId,
} from '../client';

const fetchMock = vi.fn();

function jsonResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response;
}

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  setCurrentUserId('user-1');
});

afterEach(() => {
  vi.unstubAllGlobals();
  setCurrentUserId(null);
});

describe('ApiError', () => {
  it('carries code, status, details and retryAfterSeconds off a non-OK response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(429, {
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many registration attempts. Please try again later.',
          retryAfterSeconds: 3600,
        },
      }),
    );

    const err = await request('/auth/register', { method: 'POST', body: '{}' }).catch((e) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect(err).toBeInstanceOf(Error);
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.status).toBe(429);
    expect(err.retryAfterSeconds).toBe(3600);
    expect(err.message).toBe('Too many registration attempts. Please try again later.');
  });

  it('exposes validation details as field errors', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: [
            { field: 'email', message: 'Email must be a valid RFC 5322 address' },
            { field: 'password', message: 'Password does not meet strength requirements' },
          ],
        },
      }),
    );

    const err = (await request('/auth/register', { method: 'POST', body: '{}' }).catch(
      (e) => e,
    )) as ApiError;

    expect(err.fieldErrors()).toEqual([
      { field: 'email', message: 'Email must be a valid RFC 5322 address' },
      { field: 'password', message: 'Password does not meet strength requirements' },
    ]);
  });

  it('returns no field errors when details is absent or the wrong shape', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, { error: { code: 'EMAIL_IN_USE', message: 'taken', details: 'nope' } }),
    );

    const err = (await request('/auth/register', { method: 'POST', body: '{}' }).catch(
      (e) => e,
    )) as ApiError;

    expect(err.code).toBe('EMAIL_IN_USE');
    expect(err.fieldErrors()).toEqual([]);
  });

  it('falls back to HTTP <status> when the body is not parseable JSON', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('not json')),
    } as unknown as Response);

    const err = (await request('/auth/login', { method: 'POST', body: '{}' }).catch(
      (e) => e,
    )) as ApiError;

    expect(err.message).toBe('HTTP 502');
    expect(err.code).toBe('HTTP_ERROR');
    expect(err.status).toBe(502);
  });
});

describe('auth client functions', () => {
  it('apiRegister omits displayName when not supplied', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { user: { id: 'u1' } }));

    await apiRegister('a@b.com', 'pw');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: 'a@b.com',
      password: 'pw',
    });
  });

  it('apiRegister includes displayName when supplied', async () => {
    fetchMock.mockResolvedValue(jsonResponse(201, { user: { id: 'u1' } }));

    await apiRegister('a@b.com', 'pw', 'Alice');

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: 'a@b.com',
      password: 'pw',
      displayName: 'Alice',
    });
  });

  it('apiRequestPasswordReset posts the email to /auth/reset-password', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { message: 'sent' }));

    const result = await apiRequestPasswordReset('a@b.com');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/auth/reset-password');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'a@b.com' });
    expect(result.message).toBe('sent');
  });

  it('apiConfirmPasswordReset posts token and newPassword', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true }));

    await apiConfirmPasswordReset('tok', 'new-password');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/v1/auth/reset-password/confirm');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      token: 'tok',
      newPassword: 'new-password',
    });
  });
});

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const PlannerIcon64 = () => (
  <img src="/images/bulletjournal-planner.png" width={64} height={64} alt="" style={{ display: 'block', margin: '0 auto' }} />
);

export function LoginPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('dev@planner.local');
  const [password, setPassword] = useState('password123');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 12px',
    fontSize: '14px',
    fontFamily: '"Lora", serif',
    color: 'var(--color-ink)',
    background: 'var(--color-cream)',
    border: '1px solid var(--color-dot)',
    borderRadius: '4px',
    outline: 'none',
    lineHeight: '24px',
    height: '48px',
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'transparent',
      }}
    >
      <div style={{ width: '320px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <PlannerIcon64 />
          <h1
            style={{
              fontFamily: '"Lora", serif',
              fontSize: '18px',
              lineHeight: '24px',
              fontWeight: 600,
              color: 'var(--color-ink)',
              margin: '8px 0 0',
              padding: 0,
            }}
          >
            Planner
          </h1>
          <p
            style={{
              fontSize: '13px',
              lineHeight: '24px',
              color: 'var(--color-ink-light)',
              opacity: 0.6,
              margin: 0,
              padding: 0,
            }}
          >
            Bulletjournal online
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mode === 'register' && (
            <input
              type="text"
              placeholder="Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              style={inputStyle}
              autoFocus
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
            autoFocus={mode === 'login'}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={inputStyle}
          />

          {error && (
            <p style={{ fontSize: '13px', color: 'var(--color-accent)', margin: 0 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              height: '48px',
              padding: '0 12px',
              fontSize: '14px',
              fontFamily: '"Lora", serif',
              fontWeight: 600,
              color: 'var(--color-cream)',
              background: 'var(--color-ink)',
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p style={{ fontSize: '11px', color: 'var(--color-ink-light)', textAlign: 'center', marginTop: '16px', fontStyle: 'italic', opacity: 0.7 }}>
          Dev account: dev@planner.local / password123
        </p>

        <p style={{ fontSize: '12px', color: 'var(--color-ink-light)', textAlign: 'center', marginTop: '12px' }}>
          {mode === 'login' ? (
            <>No account?{' '}
              <button
                onClick={() => setMode('register')}
                style={{ background: 'none', border: 'none', color: 'var(--color-ink)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
              >
                Register
              </button>
            </>
          ) : (
            <>Already have one?{' '}
              <button
                onClick={() => setMode('login')}
                style={{ background: 'none', border: 'none', color: 'var(--color-ink)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

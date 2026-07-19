import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';

const PlannerIcon64 = () => (
  <img src="/images/bulletjournal-planner-64x64.png" width={64} height={64} alt="" className="block mx-auto" />
);

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(import.meta.env.DEV ? 'dev@planner.local' : '');
  const [password, setPassword] = useState(import.meta.env.DEV ? 'password123' : '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/daily', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const inputClassName = "block w-full box-border p-3 text-sm text-ink bg-cream border border-dot rounded outline-none leading-6 h-12";

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-6">
      <div className="w-full max-w-80">
        <div className="text-center mb-6">
          <PlannerIcon64 />
          <h1 className="text-lg leading-6 font-semibold text-ink mt-2">
            Planner
          </h1>
          <p className="text-[13px] leading-6 text-ink-light opacity-60">
            Bulletjournal online
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className={inputClassName}
            autoFocus
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className={inputClassName}
          />

          {error && (
            <p className="text-[13px] text-accent">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className={`h-12 px-3 text-sm font-semibold text-cream bg-ink border-none rounded ${loading ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
          >
            {loading ? '…' : 'Sign in'}
          </button>
        </form>

        {import.meta.env.DEV && (
          <p className="text-[11px] text-ink-light text-center mt-4 italic opacity-70">
            Dev account: dev@planner.local / password123
          </p>
        )}
      </div>
    </div>
  );
}

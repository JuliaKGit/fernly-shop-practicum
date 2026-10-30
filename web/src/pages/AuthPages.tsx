import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { ErrorBanner } from '../components/Feedback';
import styles from './Pages.module.css';

function useNext(): string {
  const [params] = useSearchParams();
  const next = params.get('next') ?? '/';
  return next.startsWith('/') ? next : '/';
}

export function LoginPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const next = useNext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email, password);
      navigate(next, { replace: true });
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.authForm} onSubmit={submit} noValidate>
      <h1>Sign in</h1>
      {error ? <ErrorBanner message={error} /> : null}
      <div className={styles.field}>
        <label htmlFor="login-email">Email</label>
        <input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className={styles.field}>
        <label htmlFor="login-password">Password</label>
        <input id="login-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      <button type="submit" className={styles.primary} disabled={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p>
        New to Fernly? <Link to={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link>
      </p>
    </form>
  );
}

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const next = useNext();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register(name, email, password);
      navigate(next, { replace: true });
    } catch (caught) {
      setError((caught as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={styles.authForm} onSubmit={submit} noValidate>
      <h1>Create an account</h1>
      {error ? <ErrorBanner message={error} /> : null}
      <div className={styles.field}>
        <label htmlFor="register-name">Name</label>
        <input id="register-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className={styles.field}>
        <label htmlFor="register-email">Email</label>
        <input id="register-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className={styles.field}>
        <label htmlFor="register-password">Password</label>
        <input id="register-password" type="password" autoComplete="new-password" aria-describedby="register-password-hint" value={password} onChange={(event) => setPassword(event.target.value)} />
        <span id="register-password-hint" className={styles.hint}>
          At least 8 characters.
        </span>
      </div>
      <button type="submit" className={styles.primary} disabled={busy}>
        {busy ? 'Creating…' : 'Create account'}
      </button>
      <p>
        Already have an account? <Link to={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
      </p>
    </form>
  );
}

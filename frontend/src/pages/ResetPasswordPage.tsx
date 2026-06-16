import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import * as authApi from '../api/auth';

export function ResetPasswordPage() {
  const [searchParams]                    = useSearchParams();
  const token                             = searchParams.get('token') ?? '';
  const navigate                          = useNavigate();

  const [password,    setPassword]        = useState('');
  const [confirm,     setConfirm]         = useState('');
  const [showPw,      setShowPw]          = useState(false);
  const [showConfirm, setShowConfirm]     = useState(false);
  const [submitting,  setSubmitting]      = useState(false);
  const [done,        setDone]            = useState(false);
  const [error,       setError]           = useState('');

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-bg">
        <div className="text-center" style={{ maxWidth: 400 }}>
          <AlertCircle className="w-10 h-10 text-danger mx-auto mb-4" />
          <h1 className="text-[20px] font-bold text-text mb-2">Invalid link</h1>
          <p className="text-[14px] text-text2 mb-6">
            This reset link is missing or malformed. Please request a new one.
          </p>
          <Link to="/forgot-password" className="text-accent hover:underline font-medium text-[14px]">
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      setTimeout(() => navigate('/login', { replace: true }), 3000);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Invalid or expired reset link.';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-bg">
      <div className="w-full page-enter" style={{ maxWidth: 440 }}>

        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent-glow)', border: '1px solid rgba(124,110,248,0.3)' }}
          >
            <ShieldCheck className="w-4 h-4 text-accent" />
          </div>
          <span className="text-[20px] font-bold text-text">StockFlow</span>
        </div>

        <div
          className="rounded-xl"
          style={{
            background: 'var(--surface)',
            border:     '1px solid var(--border)',
            padding:    '40px',
            boxShadow:  '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {done ? (
            /* ── Success state ── */
            <div className="text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)' }}
              >
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <h1 className="text-[20px] font-bold text-text mb-2">Password updated</h1>
              <p className="text-[14px] text-text2">
                Redirecting you to sign in…
              </p>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div className="mb-8">
                <h1 className="text-[22px] font-bold text-text leading-none">Set new password</h1>
                <p className="text-[14px] text-text2 mt-2">
                  Choose a strong password for your account.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {/* New password */}
                <div>
                  <label className="block text-[12px] font-medium text-text2 mb-1.5"
                         style={{ letterSpacing: '0.02em' }}>
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoFocus
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="w-full rounded-lg text-[14px] text-text placeholder-text3 focus:outline-none pr-11"
                      style={{
                        background: 'var(--surface2)',
                        border:     '1px solid var(--border)',
                        padding:    '10px 14px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text3 hover:text-text2"
                      tabIndex={-1}
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Confirm password */}
                <div>
                  <label className="block text-[12px] font-medium text-text2 mb-1.5"
                         style={{ letterSpacing: '0.02em' }}>
                    Confirm password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="w-full rounded-lg text-[14px] text-text placeholder-text3 focus:outline-none pr-11"
                      style={{
                        background: 'var(--surface2)',
                        border:     `1px solid ${error && error.includes('match') ? 'var(--red)' : 'var(--border)'}`,
                        padding:    '10px 14px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text3 hover:text-text2"
                      tabIndex={-1}
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div
                    className="flex items-center gap-2.5 rounded-lg text-[13px] text-danger"
                    style={{
                      background: 'var(--red-bg)',
                      border:     '1px solid var(--red-border)',
                      padding:    '12px 14px',
                    }}
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-lg text-[15px] font-semibold text-white transition-all disabled:opacity-60"
                  style={{
                    background: submitting ? 'var(--accent2)' : 'var(--accent)',
                    padding:    '12px 20px',
                  }}
                  onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = 'var(--accent2)'; }}
                  onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = 'var(--accent)'; }}
                >
                  {submitting ? (
                    <><span className="btn-spinner" />Updating…</>
                  ) : (
                    'Update password'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        {!done && (
          <p className="text-center text-[13px] text-text3 mt-5">
            <Link to="/login" className="text-accent hover:underline font-medium flex items-center justify-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to sign in
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

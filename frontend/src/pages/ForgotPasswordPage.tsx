import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle, ShieldCheck } from 'lucide-react';
import * as authApi from '../api/auth';

export function ForgotPasswordPage() {
  const [email,       setEmail]      = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [sent,        setSent]        = useState(false);
  const [error,       setError]       = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError('Email is required'); return; }
    setError('');
    setSubmitting(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
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
            background:  'var(--surface)',
            border:      '1px solid var(--border)',
            padding:     '40px',
            boxShadow:   '0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          {sent ? (
            /* ── Success state ── */
            <div className="text-center">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)' }}
              >
                <CheckCircle className="w-6 h-6 text-success" />
              </div>
              <h1 className="text-[20px] font-bold text-text mb-2">Check your email</h1>
              <p className="text-[14px] text-text2 leading-relaxed">
                If an account exists for <strong className="text-text">{email}</strong>,
                a password reset link has been sent.
              </p>
              <p className="text-[12px] text-text3 mt-3">
                The link expires in 1 hour.
              </p>
            </div>
          ) : (
            /* ── Form state ── */
            <>
              <div className="mb-8">
                <h1 className="text-[22px] font-bold text-text leading-none">Forgot password?</h1>
                <p className="text-[14px] text-text2 mt-2">
                  Enter your email and we'll send a reset link.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                <div>
                  <label className="block text-[12px] font-medium text-text2 mb-1.5"
                         style={{ letterSpacing: '0.02em' }}>
                    Email address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoFocus
                    autoComplete="email"
                    placeholder="you@company.com"
                    className="w-full rounded-lg text-[14px] text-text placeholder-text3 focus:outline-none"
                    style={{
                      background: 'var(--surface2)',
                      border:     `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
                      padding:    '10px 14px',
                    }}
                  />
                  {error && (
                    <p className="flex items-center gap-1 mt-1.5 text-[12px] text-danger">
                      <AlertCircle className="w-3 h-3 shrink-0" />
                      {error}
                    </p>
                  )}
                </div>

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
                    <><span className="btn-spinner" />Sending…</>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[13px] text-text3 mt-5">
          <Link to="/login" className="text-accent hover:underline font-medium flex items-center justify-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, AlertCircle, CheckCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as authApi from '../api/auth';

const schema = z.object({
  email:    z.email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

type FormData = z.infer<typeof schema>;

const FEATURES = [  'Real-time inventory tracking',
  'Wholesale & retail pricing',
  'Complete audit trail',
];


export function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [showPw, setShowPw]         = useState(false);
  const [serverError, setServerError] = useState('');
  const [shake, setShake]           = useState(false);

  const { data: setupStatus } = useQuery({
    queryKey: ['setup-status'],
    queryFn:  authApi.getSetupStatus,
    staleTime: Infinity,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (user && !loading) {
      const dest =
        user.role === 'cashier'   ? '/pos' :
        user.role === 'warehouse' ? '/inventory' :
        user.role === 'viewer'    ? '/products' : '/dashboard';
      navigate(dest, { replace: true });
    }
  }, [user, loading, navigate]);

  async function onSubmit(data: FormData) {
    setServerError('');
    try {
      await login(data.email, data.password);
    } catch {
      setServerError('Invalid email or password.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  }

  return (
    <div className="min-h-screen flex bg-bg">

      {/* ── Left decorative panel──── */}
      <div
        className="hidden lg:flex flex-col justify-between shrink-0 border-r border-border"
        style={{
          width: 480,
          background: 'linear-gradient(160deg, #1A1D27 0%, #13151C 60%, #0D0E12 100%)',
          padding: '48px 48px',
        }}
      >
        {/* Top: logo + tagline */}
        <div >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent-glow)', border: '1px solid rgba(124,110,248,0.3)' }}
            >
              <ShieldCheck className="w-5 h-5 text-accent" />
            </div>
            <span className="text-[22px] font-bold text-text tracking-tight">StockFlow</span>
          </div>
          <p className="text-[14px] text-text2 mt-1">Kitchen Utensils Management</p>
        </div>

        {/* Middle: feature list */}
        <div className="flex flex-col gap-5">
          <p className="text-[11px] font-semibold text-text3 uppercase tracking-widest mb-1">
            What's included
          </p>
          {FEATURES.map((f) => (
            <div key={f} className="flex items-center gap-3">
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--green-bg)', border: '1px solid var(--green-border)' }}
              >
                <CheckCircle className="w-3.5 h-3.5 text-success" />
              </div>
              <span className="text-[14px] text-text2">{f}</span>
            </div>
          ))}
        </div>

        {/* Bottom: stat mini-cards */}
        
      </div>

      {/* ── Right login area ────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className={`w-full page-enter ${shake ? 'shake' : ''}`} style={{ maxWidth: 440 }}>

          {/* Logo mark (shown on mobile where left panel is hidden) */}
          <div className="lg:hidden flex items-center gap-2.5 justify-center mb-8">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent-glow)', border: '1px solid rgba(124,110,248,0.3)' }}
            >
              <ShieldCheck className="w-4.5 h-4.5 text-accent" />
            </div>
            <span className="text-[20px] font-bold text-text">StockFlow</span>
          </div>

          {/* Card */}
          <div
            className="rounded-xl"
            style={{
              background: 'var(--surface)',
              border:  '1px solid var(--border)',
              padding: '40px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            {/* Card header */}
            <div className="mb-8">
              <h1 className="text-[24px] font-bold text-accent leading-none">StockFlow</h1>
              <p className="text-[14px] text-text2 mt-2">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
              {/* Email */}
              <div>
                <label
                  className="block text-[12px] font-medium text-text2 mb-1.5"
                  style={{ letterSpacing: '0.02em' }}
                >
                  Email address
                </label>
                <input
                  {...register('email')}
                  type="email"
                  autoFocus
                  autoComplete="email"
                  placeholder="you@company.com"
                  className={`w-full rounded-lg text-[14px] text-text placeholder-text3 transition-colors focus:outline-none ${
                    errors.email
                      ? 'border-danger focus:border-danger'
                      : 'border-border focus:border-accent'
                  }`}
                  style={{
                    background: 'var(--surface2)',
                    border: `1px solid ${errors.email ? 'var(--red)' : 'var(--border)'}`,
                    padding: '10px 14px',
                  }}
                />
                {errors.email && (
                  <p className="flex items-center gap-1 mt-1.5 text-[12px] text-danger">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  className="block text-[12px] font-medium text-text2 mb-1.5"
                  style={{ letterSpacing: '0.02em' }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    {...register('password')}
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full rounded-lg text-[14px] text-text placeholder-text3 transition-colors focus:outline-none pr-11"
                    style={{
                      background: 'var(--surface2)',
                      border: `1px solid ${errors.password ? 'var(--red)' : 'var(--border)'}`,
                      padding: '10px 14px',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((p) => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text3 hover:text-text2 transition-colors"
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="flex items-center gap-1 mt-1.5 text-[12px] text-danger">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Forgot password link */}
              <div className="flex justify-end -mt-2">
                <Link to="/forgot-password" className="text-[12px] text-accent hover:underline">
                  Forgot password?
                </Link>
              </div>

              {/* Server error */}
              {serverError && (
                <div
                  className="flex items-center gap-2.5 rounded-lg text-[13px] text-danger"
                  style={{
                    background: 'var(--red-bg)',
                    border: '1px solid var(--red-border)',
                    padding: '12px 14px',
                  }}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {serverError}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg text-[15px] font-semibold text-white transition-all disabled:opacity-60"
                style={{
                  background: isSubmitting ? 'var(--accent2)' : 'var(--accent)',
                  padding: '12px 20px',
                }}
                onMouseEnter={(e) => { if (!isSubmitting) e.currentTarget.style.background = 'var(--accent2)'; }}
                onMouseLeave={(e) => { if (!isSubmitting) e.currentTarget.style.background = 'var(--accent)'; }}
              >
                {isSubmitting ? (
                  <>
                    <span className="btn-spinner" />
                    Signing in…
                  </>
                ) : (
                  'Sign in'
                )}
              </button>
            </form>

            {/* Footer */}
            <p className="text-center text-[12px] text-text3 mt-6">
              Secure sign in powered by JWT authentication
            </p>
          </div>

          {/* Register link */}
          {setupStatus?.hasUsers === false && (
            <p className="text-center text-[13px] text-text3 mt-5">
              No accounts yet.{' '}
              <Link to="/register" className="text-accent hover:underline font-medium">
                Set up your account
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

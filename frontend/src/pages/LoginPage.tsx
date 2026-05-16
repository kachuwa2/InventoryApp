import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui/Spinner';
import { ErrorMessage } from '../components/ui/ErrorMessage';

const schema = z.object({
  email: z.string().email('Valid email required'),
  password: z.string().min(1, 'Password required'),
});

type FormData = z.infer<typeof schema>;

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [serverError, setServerError] = useState('');
  const [shake, setShake] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  useEffect(() => {
    if (user && !loading) {
      const dest =
        user.role === 'cashier' ? '/pos' :
        user.role === 'warehouse' ? '/inventory' :
        user.role === 'viewer' ? '/products' : '/dashboard';
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
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className={`w-full max-w-380px ${shake ? 'shake' : ''}`}>
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center mb-3">
            <Package className="w-6 h-6 text-accent" />
          </div>
          <h1 className="text-[22px] font-bold text-text">StockFlow</h1>
          <p className="text-text2 text-[13px] mt-1">Kitchen Utensils Management</p>
        </div>

        {/* Card */}
        <div className="bg-surface border border-border rounded-2xl p-7">
          <h2 className="text-[17px] font-semibold text-text mb-5">Sign in</h2>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div>
              <label className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">
                Email
              </label>
              <input
                {...register('email')}
                type="email"
                autoFocus
                autoComplete="email"
                placeholder="you@company.com"
                className="w-full bg-surface2 border border-border text-text placeholder-text3 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-accent transition-colors"
              />
              <ErrorMessage message={errors.email?.message} />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-surface2 border border-border text-text placeholder-text3 rounded-lg px-3 py-2.5 pr-10 text-[13px] focus:outline-none focus:border-accent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text3 hover:text-text2 transition-colors"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <ErrorMessage message={errors.password?.message} />
            </div>

            {serverError && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg px-3 py-2.5 text-danger text-[13px]">
                {serverError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-[14px] font-semibold transition-colors disabled:opacity-60 mt-1"
            >
              {isSubmitting && <Spinner size="sm" />}
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-text3 text-[13px] mt-5">
          Admin only:{' '}
          <Link to="/register" className="text-accent hover:underline">
            Register new user
          </Link>
        </p>
      </div>
    </div>
  );
}

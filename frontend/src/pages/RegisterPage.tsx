import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Package } from 'lucide-react';
import { Spinner } from '../components/ui/Spinner';
import { ErrorMessage } from '../components/ui/ErrorMessage';
import * as authApi from '../api/auth';

const ROLES = ['admin', 'manager', 'cashier', 'warehouse', 'viewer'] as const;

const schema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z.email('Valid email required'),
    password: z.string().min(8, 'Min 8 characters'),
    confirmPassword: z.string(),
    role: z.enum(ROLES),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export function RegisterPage() {
  const [showPw, setShowPw] = useState(false);
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'cashier' },
  });

  const password = useWatch({ control, name: 'password', defaultValue: '' });
  const strength = password.length >= 12 ? 3 : password.length >= 8 ? 2 : password.length >= 4 ? 1 : 0;
  const strengthLabel = ['', 'Weak', 'Good', 'Strong'][strength];
  const strengthColor = ['', 'bg-danger', 'bg-warning', 'bg-success'][strength];

  async function onSubmit(data: FormData) {
    setServerError('');
    try {
      await authApi.register({ name: data.name, email: data.email, password: data.password, role: data.role });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setServerError(msg ?? 'Registration failed. Email may already be taken.');
    }
  }

  if (success) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center p-4">
        <div className="bg-surface border border-border rounded-2xl p-8 max-w-sm w-full text-center">
          <div className="w-12 h-12 rounded-xl bg-success/15 flex items-center justify-center mx-auto mb-4">
            <Package className="w-6 h-6 text-success" />
          </div>
          <h2 className="text-[18px] font-semibold text-text mb-2">User registered</h2>
          <p className="text-text2 text-[13px] mb-5">The new user can now sign in with their credentials.</p>
          <Link to="/login" className="inline-flex px-5 py-2.5 bg-accent text-white rounded-lg text-[13px] font-medium hover:bg-accent/90 transition-colors">
            Back to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-105">
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center mb-3">
            <Package className="w-6 h-6 text-accent" />
          </div>
          <h1 className="text-[22px] font-bold text-text">StockFlow</h1>
          <p className="text-text2 text-[13px] mt-1">Register a new user</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl p-7">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <div>
              <label className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">Full Name</label>
              <input {...register('name')} placeholder="Sara Kimani" className="w-full bg-surface2 border border-border text-text placeholder-text3 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-accent transition-colors" />
              <ErrorMessage message={errors.name?.message} />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">Email</label>
              <input {...register('email')} type="email" placeholder="sara@shop.com" className="w-full bg-surface2 border border-border text-text placeholder-text3 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-accent transition-colors" />
              <ErrorMessage message={errors.email?.message} />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">Password</label>
              <div className="relative">
                <input {...register('password')} type={showPw ? 'text' : 'password'} placeholder="Min 8 characters" className="w-full bg-surface2 border border-border text-text placeholder-text3 rounded-lg px-3 py-2.5 pr-10 text-[13px] focus:outline-none focus:border-accent transition-colors" />
                <button type="button" onClick={() => setShowPw((p) => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-text3 hover:text-text2">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor : 'bg-border'}`} />
                    ))}
                  </div>
                  <span className="text-[11px] text-text2">{strengthLabel}</span>
                </div>
              )}
              <ErrorMessage message={errors.password?.message} />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">Confirm Password</label>
              <input {...register('confirmPassword')} type="password" placeholder="Repeat password" className="w-full bg-surface2 border border-border text-text placeholder-text3 rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-accent transition-colors" />
              <ErrorMessage message={errors.confirmPassword?.message} />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-text2 uppercase tracking-wide mb-1.5">Role</label>
              <select {...register('role')} className="w-full bg-surface2 border border-border text-text rounded-lg px-3 py-2.5 text-[13px] focus:outline-none focus:border-accent transition-colors cursor-pointer">
                {ROLES.map((r) => (
                  <option key={r} value={r} className="capitalize">{r.charAt(0).toUpperCase() + r.slice(1)}</option>
                ))}
              </select>
              <ErrorMessage message={errors.role?.message} />
            </div>

            {serverError && (
              <div className="bg-danger/10 border border-danger/30 rounded-lg px-3 py-2.5 text-danger text-[13px]">{serverError}</div>
            )}

            <button type="submit" disabled={isSubmitting} className="flex items-center justify-center gap-2 w-full py-2.5 bg-accent hover:bg-accent/90 text-white rounded-lg text-[14px] font-semibold transition-colors disabled:opacity-60 mt-1">
              {isSubmitting && <Spinner size="sm" />}
              {isSubmitting ? 'Registering…' : 'Create User'}
            </button>
          </form>
        </div>

        <p className="text-center text-text3 text-[13px] mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-accent hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

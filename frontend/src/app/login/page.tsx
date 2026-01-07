'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Vote, Eye, EyeOff, Loader2, User, Lock, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      router.replace('/dashboard');
    } catch (err) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || '登录失败，请检查用户名和密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-zinc-50 flex items-center justify-center p-4 overflow-auto">
      <div className="w-full max-w-sm my-auto">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-zinc-900 rounded-xl mb-5">
            <Vote className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 tracking-tight">业主大会投票管理系统</h1>
          <p className="text-[13px] text-zinc-500 mt-1">请登录您的账户以继续</p>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2.5 rounded-lg text-[13px] flex items-center gap-2.5 animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-zinc-700">
                用户名
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 bg-white border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 text-[14px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200"
                  placeholder="请输入用户名"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-zinc-700">
                密码
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="w-4 h-4 text-zinc-400 group-focus-within:text-zinc-600 transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-zinc-200 rounded-lg text-zinc-900 placeholder-zinc-400 text-[14px] focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all duration-200"
                  placeholder="请输入密码"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-zinc-900 text-white py-2.5 px-4 rounded-lg text-[14px] font-medium hover:bg-zinc-800 focus:ring-2 focus:ring-zinc-900/20 focus:ring-offset-2 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  登录中...
                </span>
              ) : (
                '登录'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[12px] text-zinc-400 mt-6">
          业主大会投票管理系统 &copy; 2026
        </p>
      </div>
    </div>
  );
}

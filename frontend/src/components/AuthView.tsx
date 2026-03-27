import { useState, FormEvent } from 'react';

interface Props {
  onLogin: (username: string, password: string) => Promise<void>;
  onRegister: (data: {
    username: string;
    email: string;
    password: string;
    full_name: string;
  }) => Promise<void>;
  error: string | null;
}

export default function AuthView({ onLogin, onRegister, error }: Props) {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [loading, setLoading] = useState(false);

  // login fields
  const [loginUser, setLoginUser] = useState('');
  const [loginPass, setLoginPass] = useState('');

  // register fields
  const [regUser, setRegUser] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');
  const [regName, setRegName] = useState('');

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onLogin(loginUser, loginPass);
    } catch {
      // error handled by parent
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onRegister({
        username: regUser,
        email: regEmail,
        password: regPass,
        full_name: regName,
      });
    } catch {
      // error handled by parent
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm transition-all duration-200';

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-1/4 -left-32 w-[500px] h-[500px] bg-blue-600/[0.08] rounded-full blur-[120px]" />

      <div className="glass-strong rounded-2xl p-8 w-full max-w-md animate-fade-in relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-gradient-to-br from-blue-600 to-blue-500 mb-4">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">Cloud Microservices</h1>
          <p className="text-gray-400 text-sm mt-1">Task Management Platform</p>
        </div>

        {/* Tabs */}
        <div className="flex mb-6 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setTab('login')}
            className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
              tab === 'login'
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => setTab('register')}
            className={`flex-1 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
              tab === 'register'
                ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-lg'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Register
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Login Form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Username</label>
              <input
                type="text"
                value={loginUser}
                onChange={(e) => setLoginUser(e.target.value)}
                className={inputClass}
                placeholder="Enter your username"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password</label>
              <input
                type="password"
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className={inputClass}
                placeholder="Enter your password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium text-sm hover:from-blue-500 hover:to-blue-400 transition-all duration-200 disabled:opacity-50 shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Register Form */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Full Name</label>
              <input
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                className={inputClass}
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Username</label>
              <input
                type="text"
                value={regUser}
                onChange={(e) => setRegUser(e.target.value)}
                className={inputClass}
                placeholder="johndoe"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Email</label>
              <input
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                className={inputClass}
                placeholder="john@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Password</label>
              <input
                type="password"
                value={regPass}
                onChange={(e) => setRegPass(e.target.value)}
                className={inputClass}
                placeholder="Create a password"
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium text-sm hover:from-blue-500 hover:to-blue-400 transition-all duration-200 disabled:opacity-50 shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { User, HealthStatus, getHealth } from '../api';
import NotificationBell from './NotificationBell';

interface Props {
  user: User;
  onLogout: () => void;
  onCreateTask: () => void;
}

export default function Header({ user, onLogout, onCreateTask }: Props) {
  const [health, setHealth] = useState<HealthStatus | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const h = await getHealth();
        if (mounted) setHealth(h);
      } catch {
        if (mounted) setHealth(null);
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const isHealthy = (health as any)?.all_healthy === true || health?.status === 'healthy';

  const serviceEntries = health?.services ? Object.entries(health.services) : [];

  return (
    <header className="glass border-b border-white/[0.06] sticky top-0 z-40">
      <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
        {/* Left: Logo + Name */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 flex items-center justify-center shadow-lg shadow-blue-600/20">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Cloud Tasks</h1>
            <p className="text-[11px] text-gray-500">Microservices Dashboard</p>
          </div>
        </div>

        {/* Center: Create Task */}
        <button
          onClick={onCreateTask}
          className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white text-sm font-medium hover:from-blue-500 hover:to-blue-400 transition-all shadow-lg shadow-blue-600/25 hover:shadow-blue-600/40"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Task
        </button>

        {/* Right: Health, Notifications, User */}
        <div className="flex items-center gap-3">
          {/* Service Health */}
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <div className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-green-400' : 'bg-red-400'} ${isHealthy ? 'animate-pulse' : ''}`} />
            <span className="text-xs text-gray-400">
              {isHealthy ? 'All systems go' : 'Issues detected'}
            </span>
            {serviceEntries.length > 0 && (
              <div className="flex items-center gap-1 ml-1 pl-2 border-l border-white/10">
                {serviceEntries.map(([name, svc]) => (
                  <div
                    key={name}
                    title={`${name}: ${svc.status}`}
                    className={`w-1.5 h-1.5 rounded-full ${
                      svc.status === 'healthy' || svc.status === 'ok'
                        ? 'bg-green-400'
                        : 'bg-red-400'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          <NotificationBell />

          {/* User */}
          <div className="flex items-center gap-3 pl-3 border-l border-white/10">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-bold">
              {(user.full_name || user.username || '?')[0].toUpperCase()}
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-medium text-white leading-tight">
                {user.full_name || user.username}
              </p>
              <p className="text-[11px] text-gray-500">{user.email}</p>
            </div>
            <button
              onClick={onLogout}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors text-gray-400 hover:text-white"
              title="Logout"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

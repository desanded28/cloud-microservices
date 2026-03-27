import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import AuthView from './components/AuthView';
import Header from './components/Header';
import KanbanBoard from './components/KanbanBoard';
import CreateTaskModal from './components/CreateTaskModal';

export default function App() {
  const { user, loading, error, login, register, logout } = useAuth();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey((k) => k + 1);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Auth view
  if (!user) {
    return <AuthView onLogin={login} onRegister={register} error={error} />;
  }

  // Dashboard
  return (
    <div className="min-h-screen bg-dark-900">
      <Header
        user={user}
        onLogout={logout}
        onCreateTask={() => setShowCreateModal(true)}
      />

      {/* Mobile create button */}
      <div className="sm:hidden fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setShowCreateModal(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-xl shadow-blue-600/30 flex items-center justify-center hover:scale-105 transition-transform"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <KanbanBoard refreshKey={refreshKey} />

      <CreateTaskModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={refresh}
      />
    </div>
  );
}

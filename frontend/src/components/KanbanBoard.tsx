import { useState, useEffect, useCallback } from 'react';
import { Task, getTasks } from '../api';
import TaskCard from './TaskCard';

interface Column {
  key: Task['status'];
  label: string;
  tint: string;
  dotColor: string;
}

const columns: Column[] = [
  { key: 'todo', label: 'Todo', tint: 'col-todo', dotColor: 'bg-blue-400' },
  { key: 'in_progress', label: 'In Progress', tint: 'col-in-progress', dotColor: 'bg-amber-400' },
  { key: 'in_review', label: 'In Review', tint: 'col-in-review', dotColor: 'bg-purple-400' },
  { key: 'done', label: 'Done', tint: 'col-done', dotColor: 'bg-green-400' },
];

interface Props {
  refreshKey: number;
}

export default function KanbanBoard({ refreshKey }: Props) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = await getTasks();
      setTasks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // Poll for updates
  useEffect(() => {
    const interval = setInterval(load, 10000);
    return () => clearInterval(interval);
  }, [load]);

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = searchQuery === '' ||
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  const tasksByStatus = (status: Task['status']) =>
    filteredTasks.filter((t) => t.status === status);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading tasks...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-32 px-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6 max-w-md text-center">
          <svg className="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-300 mb-4">{error}</p>
          <button
            onClick={() => { setLoading(true); load(); }}
            className="px-5 py-2 rounded-lg bg-red-500/20 text-red-300 text-sm font-medium hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-6 pt-4 pb-6">
      {/* Search + Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            placeholder="Search tasks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:outline-none focus:border-blue-500/50 transition-colors appearance-none cursor-pointer"
        >
          <option value="all">All Priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
      {columns.map((col, idx) => {
        const colTasks = tasksByStatus(col.key);
        return (
          <div
            key={col.key}
            className={`${col.tint} rounded-xl p-4 glass min-h-[400px] animate-slide-up stagger-${idx + 1}`}
            style={{ animationFillMode: 'both' }}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${col.dotColor}`} />
                <h2 className="text-sm font-semibold text-white">{col.label}</h2>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-white/5 text-[11px] text-gray-400 font-medium">
                {colTasks.length}
              </span>
            </div>

            {/* Task cards */}
            <div className="space-y-3">
              {colTasks.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center mx-auto mb-2">
                    <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                  <p className="text-xs text-gray-600">No tasks</p>
                </div>
              ) : (
                colTasks.map((task) => (
                  <TaskCard key={task.id} task={task} onUpdated={load} />
                ))
              )}
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { Task, updateTask, updateTaskStatus } from '../api';

interface Props {
  task: Task;
  onUpdated: () => void;
}

const priorityConfig = {
  low: { color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', glow: 'glow-blue', label: 'Low' },
  medium: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', glow: 'glow-amber', label: 'Medium' },
  high: { color: 'bg-red-500/20 text-red-400 border-red-500/30', glow: 'glow-red', label: 'High' },
  critical: { color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', glow: 'glow-purple', label: 'Critical' },
};

const statusOptions: { value: Task['status']; label: string }[] = [
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

export default function TaskCard({ task, onUpdated }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editDesc, setEditDesc] = useState(task.description || '');
  const [saving, setSaving] = useState(false);

  const priority = priorityConfig[task.priority] || priorityConfig.low;

  const handleStatusChange = async (newStatus: Task['status']) => {
    try {
      await updateTaskStatus(task.id, newStatus);
      onUpdated();
    } catch {
      // ignore
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      await updateTask(task.id, { title: editTitle, description: editDesc });
      setEditing(false);
      onUpdated();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const dueDate = task.due_date ? new Date(task.due_date) : null;
  const isOverdue = dueDate && dueDate < new Date() && task.status !== 'done';

  return (
    <div
      className={`task-card glass rounded-xl p-4 cursor-pointer group hover:bg-white/[0.06] ${
        expanded ? 'ring-1 ring-blue-500/30' : ''
      }`}
      onClick={() => !editing && setExpanded(!expanded)}
    >
      {/* Top row: priority + actions */}
      <div className="flex items-start justify-between mb-2">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border tracking-wide uppercase ${priority.color}`}
        >
          {priority.label}
        </span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
              setExpanded(true);
            }}
            className="p-1 rounded hover:bg-white/10 text-gray-500 hover:text-white transition-colors"
            title="Edit"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Title */}
      {editing ? (
        <input
          value={editTitle}
          onChange={(e) => setEditTitle(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className="w-full mb-2 px-2 py-1 rounded bg-white/5 border border-white/10 text-sm text-white"
        />
      ) : (
        <h3 className="text-sm font-semibold text-white mb-1 line-clamp-2">{task.title}</h3>
      )}

      {/* Description preview */}
      {editing ? (
        <textarea
          value={editDesc}
          onChange={(e) => setEditDesc(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          rows={3}
          className="w-full mb-2 px-2 py-1 rounded bg-white/5 border border-white/10 text-xs text-gray-300 resize-none"
        />
      ) : (
        task.description && (
          <p className={`text-xs text-gray-400 mb-2 ${expanded ? '' : 'line-clamp-2'}`}>
            {task.description}
          </p>
        )
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-gray-400 border border-white/5"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Bottom row: assignee, due date */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
        {task.assignee_id ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-[9px] font-bold text-white">
              A
            </div>
            <span className="text-[11px] text-gray-500">Assigned</span>
          </div>
        ) : (
          <span className="text-[11px] text-gray-600">Unassigned</span>
        )}

        {dueDate && (
          <span
            className={`text-[11px] ${
              isOverdue ? 'text-red-400' : 'text-gray-500'
            }`}
          >
            {isOverdue && '! '}
            {dueDate.toLocaleDateString()}
          </span>
        )}
      </div>

      {/* Expanded: status change + edit save */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-white/5 animate-fade-in" onClick={(e) => e.stopPropagation()}>
          {editing ? (
            <div className="flex gap-2">
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="flex-1 py-1.5 rounded-lg bg-blue-600/20 text-blue-400 text-xs font-medium hover:bg-blue-600/30 transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditTitle(task.title);
                  setEditDesc(task.description || '');
                }}
                className="flex-1 py-1.5 rounded-lg bg-white/5 text-gray-400 text-xs font-medium hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div>
              <p className="text-[11px] text-gray-500 mb-1.5">Move to:</p>
              <div className="flex flex-wrap gap-1.5">
                {statusOptions
                  .filter((s) => s.value !== task.status)
                  .map((s) => (
                    <button
                      key={s.value}
                      onClick={() => handleStatusChange(s.value)}
                      className="px-3 py-1.5 rounded-lg bg-white/[0.04] text-gray-400 text-[11px] font-medium hover:bg-white/10 hover:text-white transition-all duration-200 border border-white/[0.06] hover:border-white/10"
                    >
                      {s.label}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

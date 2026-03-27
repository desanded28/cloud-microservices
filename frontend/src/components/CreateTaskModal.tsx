import { useState, FormEvent } from 'react';
import { createTask, CreateTaskPayload } from '../api';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateTaskModal({ open, onClose, onCreated }: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [assigneeId, setAssigneeId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const payload: CreateTaskPayload = {
      title,
      description,
      priority,
      tags,
    };
    if (assigneeId.trim()) payload.assignee_id = assigneeId.trim();
    if (dueDate) payload.due_date = dueDate;

    try {
      await createTask(payload);
      // Reset form
      setTitle('');
      setDescription('');
      setPriority('medium');
      setAssigneeId('');
      setDueDate('');
      setTagsInput('');
      onCreated();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm transition-all duration-200';

  return (
    <div
      className="fixed inset-0 modal-backdrop z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="glass-strong rounded-2xl p-6 w-full max-w-lg animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Create New Task</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
              placeholder="Task title"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} resize-none`}
              rows={3}
              placeholder="Describe the task..."
            />
          </div>

          {/* Priority + Due Date row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className={inputClass}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1.5">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className={`${inputClass} [color-scheme:dark]`}
              />
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Assignee ID</label>
            <input
              type="text"
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value)}
              className={inputClass}
              placeholder="Optional: user ID to assign"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Tags</label>
            <input
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              className={inputClass}
              placeholder="Comma-separated tags (e.g. backend, urgent)"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-lg bg-gradient-to-r from-blue-600 to-blue-500 text-white font-medium text-sm hover:from-blue-500 hover:to-blue-400 transition-all disabled:opacity-50 shadow-lg shadow-blue-600/20"
            >
              {loading ? 'Creating...' : 'Create Task'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-3 rounded-lg bg-white/5 text-gray-400 text-sm font-medium hover:bg-white/10 hover:text-white transition-all border border-white/10"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

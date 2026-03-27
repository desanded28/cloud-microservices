// ── Types ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  full_name: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee_id?: string;
  due_date?: string;
  tags: string[];
  created_at?: string;
  updated_at?: string;
}

export interface Notification {
  id: string;
  event: string;
  data: Record<string, string>;
  delivered_to: string[];
  created_at: string;
}

export interface HealthStatus {
  status: string;
  services?: Record<string, { status: string }>;
}

export interface CreateTaskPayload {
  title: string;
  description: string;
  priority: string;
  assignee_id?: string;
  due_date?: string;
  tags: string[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem('token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders(),
    ...(options.headers as Record<string, string> || {}),
  };

  const res = await fetch(url, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.message || `Request failed (${res.status})`);
  }

  return res.json();
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function register(data: {
  username: string;
  email: string;
  password: string;
  full_name: string;
}): Promise<User> {
  return request<User>('/api/users/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function login(username: string, password: string): Promise<string> {
  const res = await request<{ access_token: string }>('/api/users/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  return res.access_token;
}

export async function getMe(): Promise<User> {
  return request<User>('/api/users/me');
}

// ── Tasks ────────────────────────────────────────────────────────────────────

export async function getTasks(params?: {
  status?: string;
  priority?: string;
  assignee_id?: string;
}): Promise<Task[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  if (params?.priority) query.set('priority', params.priority);
  if (params?.assignee_id) query.set('assignee_id', params.assignee_id);
  const qs = query.toString();
  const url = `/api/tasks${qs ? `?${qs}` : ''}`;
  const res = await request<Task[] | { tasks: Task[] }>(url);
  return Array.isArray(res) ? res : res.tasks ?? [];
}

export async function createTask(data: CreateTaskPayload): Promise<Task> {
  return request<Task>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateTask(id: string, data: Partial<Task>): Promise<Task> {
  return request<Task>(`/api/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function updateTaskStatus(
  id: string,
  status: Task['status']
): Promise<Task> {
  return request<Task>(`/api/tasks/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

// ── Notifications ────────────────────────────────────────────────────────────

export async function getNotifications(): Promise<Notification[]> {
  const res = await request<Notification[] | { notifications: Notification[] }>(
    '/api/notifications'
  );
  return Array.isArray(res) ? res : res.notifications ?? [];
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function getHealth(): Promise<HealthStatus> {
  return request<HealthStatus>('/health');
}

/**
 * Tools: create_task, list_tasks, update_task
 * Manages a simple in-memory task store.
 * These tools require authentication (tools:write / tasks:read scope).
 */

import { v4 as uuidv4 } from "uuid";

export type TaskStatus   = "todo" | "in_progress" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface Task {
  id:          string;
  title:       string;
  description: string;
  status:      TaskStatus;
  priority:    TaskPriority;
  assignee:    string;
  createdBy:   string;
  createdAt:   string;
  updatedAt:   string;
  dueDate?:    string;
  tags:        string[];
}

// In-memory store (use a real DB in production)
const taskStore = new Map<string, Task>();

// Seed with some demo tasks
const seedTasks: Omit<Task, "id" | "createdAt" | "updatedAt">[] = [
  {
    title: "Set up CI/CD pipeline",
    description: "Configure GitHub Actions for automated testing and deployment.",
    status: "in_progress",
    priority: "high",
    assignee: "alice@example.com",
    createdBy: "user1",
    tags: ["devops", "automation"],
  },
  {
    title: "Write API documentation",
    description: "Document all REST API endpoints using OpenAPI 3.0 spec.",
    status: "todo",
    priority: "medium",
    assignee: "bob@example.com",
    createdBy: "user1",
    dueDate: "2025-03-15",
    tags: ["docs"],
  },
  {
    title: "Fix login page bug",
    description: "Users report intermittent 401 errors on login.",
    status: "done",
    priority: "critical",
    assignee: "alice@example.com",
    createdBy: "user2",
    tags: ["bug", "auth"],
  },
];

for (const t of seedTasks) {
  const id = uuidv4();
  const now = new Date().toISOString();
  taskStore.set(id, { ...t, id, createdAt: now, updatedAt: now });
}

// ─────────────────────────────────────────────
// CRUD helpers
// ─────────────────────────────────────────────

export function createTask(
  title: string,
  description: string,
  priority: TaskPriority = "medium",
  assignee: string = "unassigned",
  createdBy: string,
  dueDate?: string,
  tags: string[] = []
): Task {
  const id = uuidv4();
  const now = new Date().toISOString();
  const task: Task = {
    id, title, description, priority, assignee,
    createdBy, dueDate, tags,
    status: "todo",
    createdAt: now,
    updatedAt: now,
  };
  taskStore.set(id, task);
  return task;
}

export function listTasks(filters?: {
  status?: TaskStatus;
  priority?: TaskPriority;
  assignee?: string;
  tag?: string;
}): Task[] {
  let tasks = Array.from(taskStore.values());

  if (filters?.status)   tasks = tasks.filter((t) => t.status   === filters.status);
  if (filters?.priority) tasks = tasks.filter((t) => t.priority === filters.priority);
  if (filters?.assignee) tasks = tasks.filter((t) => t.assignee.toLowerCase().includes(filters.assignee!.toLowerCase()));
  if (filters?.tag)      tasks = tasks.filter((t) => t.tags.includes(filters.tag!));

  return tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getTask(id: string): Task | undefined {
  return taskStore.get(id);
}

export function updateTask(
  id: string,
  updates: Partial<Pick<Task, "title" | "description" | "status" | "priority" | "assignee" | "dueDate" | "tags">>
): Task | null {
  const task = taskStore.get(id);
  if (!task) return null;
  const updated: Task = { ...task, ...updates, updatedAt: new Date().toISOString() };
  taskStore.set(id, updated);
  return updated;
}

export function deleteTask(id: string): boolean {
  return taskStore.delete(id);
}

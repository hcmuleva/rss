import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { db, nextId } from '../db';

export const projectsRouter = Router();

const createProjectTaskSchema = z.object({
  projectCategory: z.string().min(1),
  taskName: z.string().min(2),
  status: z.enum(['Assigned', 'InProgress', 'Completed', 'NotReady', 'OnHold']),
  date: z.string().min(1),
  description: z.string().min(2),
  mediaUrls: z.array(z.string().url()).optional(),
  assignedUserIds: z.array(z.string().min(1)).optional()
});

projectsRouter.get('/', authMiddleware, (_req, res) => {
  void (async () => {
    const { rows } = await db.query<{ category: string; count: number }>(
      'SELECT project_category AS category, COUNT(*)::int AS count FROM project_tasks GROUP BY project_category ORDER BY project_category'
    );
    res.json(rows);
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

projectsRouter.get('/tasks', authMiddleware, (req: AuthRequest, res) => {
  void (async () => {
    const { rows } = await db.query<{
      id: string;
      project_category: string;
      task_name: string;
      status: 'Assigned' | 'InProgress' | 'Completed' | 'NotReady' | 'OnHold';
      date: string;
      description: string;
      media_urls: string[];
      assigned_user_ids: string[];
    }>(
      req.user?.role === 'USER'
        ? 'SELECT * FROM project_tasks WHERE $1 = ANY(assigned_user_ids) ORDER BY id DESC'
        : 'SELECT * FROM project_tasks ORDER BY id DESC',
      req.user?.role === 'USER' ? [req.user.id] : []
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        projectCategory: row.project_category,
        taskName: row.task_name,
        status: row.status,
        date: row.date,
        description: row.description,
        mediaUrls: row.media_urls,
        assignedUserIds: row.assigned_user_ids
      }))
    );
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

projectsRouter.post('/tasks', authMiddleware, (req: AuthRequest, res) => {
  const parsed = createProjectTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }

  void (async () => {
    const actorId = req.user?.id ?? 'u-unknown';
    const assignedUserIds =
      req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN'
        ? (parsed.data.assignedUserIds?.length ? parsed.data.assignedUserIds : [actorId])
        : [actorId];

    const id = await nextId('pt', 'project_tasks');
    await db.query(
      `INSERT INTO project_tasks
       (id, project_category, task_name, status, date, description, assigned_user_ids, media_urls)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, parsed.data.projectCategory, parsed.data.taskName, parsed.data.status, parsed.data.date, parsed.data.description, assignedUserIds, parsed.data.mediaUrls ?? []]
    );
    res.status(201).json({ id, ...parsed.data, mediaUrls: parsed.data.mediaUrls ?? [], assignedUserIds });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

projectsRouter.get('/tasks/:id', authMiddleware, (req: AuthRequest, res) => {
  void (async () => {
    const { rows } = await db.query<{
      id: string;
      project_category: string;
      task_name: string;
      status: 'Assigned' | 'InProgress' | 'Completed' | 'NotReady' | 'OnHold';
      date: string;
      description: string;
      media_urls: string[];
      assigned_user_ids: string[];
    }>('SELECT * FROM project_tasks WHERE id = $1 LIMIT 1', [req.params.id]);
    const task = rows[0];
    if (!task) {
      res.status(404).json({ message: 'Project task not found' });
      return;
    }
    if (req.user?.role === 'USER' && !task.assigned_user_ids.includes(req.user.id)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    res.json({
      id: task.id,
      projectCategory: task.project_category,
      taskName: task.task_name,
      status: task.status,
      date: task.date,
      description: task.description,
      mediaUrls: task.media_urls,
      assignedUserIds: task.assigned_user_ids
    });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

projectsRouter.patch('/tasks/:id', authMiddleware, (req: AuthRequest, res) => {
  const parsed = createProjectTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }

  void (async () => {
    const existing = await db.query<{ assigned_user_ids: string[] }>(
      'SELECT assigned_user_ids FROM project_tasks WHERE id = $1 LIMIT 1',
      [req.params.id]
    );
    const task = existing.rows[0];
    if (!task) {
      res.status(404).json({ message: 'Project task not found' });
      return;
    }
    if (req.user?.role === 'USER' && !task.assigned_user_ids.includes(req.user.id)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const assignedUserIds =
      req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN'
        ? (parsed.data.assignedUserIds?.length ? parsed.data.assignedUserIds : task.assigned_user_ids)
        : task.assigned_user_ids;

    const updated = await db.query<{
      id: string;
      project_category: string;
      task_name: string;
      status: 'Assigned' | 'InProgress' | 'Completed' | 'NotReady' | 'OnHold';
      date: string;
      description: string;
      media_urls: string[];
      assigned_user_ids: string[];
    }>(
      `UPDATE project_tasks
       SET project_category = $1,
           task_name = $2,
           status = $3,
           date = $4,
           description = $5,
           assigned_user_ids = $6,
           media_urls = $7
       WHERE id = $8
       RETURNING *`,
      [parsed.data.projectCategory, parsed.data.taskName, parsed.data.status, parsed.data.date, parsed.data.description, assignedUserIds, parsed.data.mediaUrls ?? [], req.params.id]
    );
    const row = updated.rows[0];
    res.json({
      id: row.id,
      projectCategory: row.project_category,
      taskName: row.task_name,
      status: row.status,
      date: row.date,
      description: row.description,
      mediaUrls: row.media_urls,
      assignedUserIds: row.assigned_user_ids
    });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

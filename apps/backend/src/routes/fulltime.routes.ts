import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { db, nextId } from '../db';

export const fulltimeRouter = Router();

const createSchema = z.object({
  title: z.string().min(2),
  description: z.string().min(2),
  date: z.string().min(1),
  status: z.enum(['Assigned', 'InProgress', 'Completed', 'NotReady', 'OnHold']),
  location: z.string().min(2),
  mediaUrls: z.array(z.string().url()).optional(),
  assignedUserIds: z.array(z.string().min(1)).optional()
});

fulltimeRouter.get('/', authMiddleware, (req: AuthRequest, res) => {
  void (async () => {
    const { rows } = await db.query<{
      id: string;
      title: string;
      description: string;
      date: string;
      status: 'Assigned' | 'InProgress' | 'Completed' | 'NotReady' | 'OnHold';
      location: string;
      media_urls: string[];
      assigned_user_ids: string[];
    }>(
      req.user?.role === 'USER'
        ? 'SELECT * FROM fulltime_tasks WHERE $1 = ANY(assigned_user_ids) ORDER BY id DESC'
        : 'SELECT * FROM fulltime_tasks ORDER BY id DESC',
      req.user?.role === 'USER' ? [req.user.id] : []
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        date: row.date,
        status: row.status,
        location: row.location,
        mediaUrls: row.media_urls,
        assignedUserIds: row.assigned_user_ids
      }))
    );
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

fulltimeRouter.post('/', authMiddleware, (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
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
    const id = await nextId('ft', 'fulltime_tasks');
    await db.query(
      `INSERT INTO fulltime_tasks (id, title, description, date, status, location, media_urls, assigned_user_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, parsed.data.title, parsed.data.description, parsed.data.date, parsed.data.status, parsed.data.location, parsed.data.mediaUrls ?? [], assignedUserIds]
    );
    res.status(201).json({ id, ...parsed.data, mediaUrls: parsed.data.mediaUrls ?? [], assignedUserIds });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

fulltimeRouter.patch('/:id', authMiddleware, (req: AuthRequest, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }

  void (async () => {
    const existing = await db.query<{ assigned_user_ids: string[] }>('SELECT assigned_user_ids FROM fulltime_tasks WHERE id = $1 LIMIT 1', [req.params.id]);
    const row = existing.rows[0];
    if (!row) {
      res.status(404).json({ message: 'FullTime task not found' });
      return;
    }
    if (req.user?.role === 'USER' && !row.assigned_user_ids.includes(req.user.id)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    const assignedUserIds =
      req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN'
        ? (parsed.data.assignedUserIds?.length ? parsed.data.assignedUserIds : row.assigned_user_ids)
        : row.assigned_user_ids;
    const updated = await db.query<{
      id: string;
      title: string;
      description: string;
      date: string;
      status: 'Assigned' | 'InProgress' | 'Completed' | 'NotReady' | 'OnHold';
      location: string;
      media_urls: string[];
      assigned_user_ids: string[];
    }>(
      `UPDATE fulltime_tasks
       SET title=$1, description=$2, date=$3, status=$4, location=$5, media_urls=$6, assigned_user_ids=$7
       WHERE id=$8 RETURNING *`,
      [parsed.data.title, parsed.data.description, parsed.data.date, parsed.data.status, parsed.data.location, parsed.data.mediaUrls ?? [], assignedUserIds, req.params.id]
    );
    const task = updated.rows[0];
    res.json({
      id: task.id,
      title: task.title,
      description: task.description,
      date: task.date,
      status: task.status,
      location: task.location,
      mediaUrls: task.media_urls,
      assignedUserIds: task.assigned_user_ids
    });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

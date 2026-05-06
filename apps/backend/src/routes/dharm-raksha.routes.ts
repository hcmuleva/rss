import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { db, nextId } from '../db';

export const dharmRakshaRouter = Router();

const schema = z.object({
  nodeId: z.string().min(1),
  category: z.string().min(2),
  date: z.string().min(1),
  description: z.string().min(2),
  mediaUrls: z.array(z.string().url()).optional(),
  assignedUserIds: z.array(z.string().min(1)).optional()
});

dharmRakshaRouter.get('/', authMiddleware, (req: AuthRequest, res) => {
  void (async () => {
    const { rows } = await db.query<{
      id: string;
      node_id: string;
      category: string;
      date: string;
      description: string;
      media_urls: string[];
      assigned_user_ids: string[];
    }>(
      req.user?.role === 'USER'
        ? 'SELECT * FROM dharm_raksha_entries WHERE $1 = ANY(assigned_user_ids) ORDER BY id DESC'
        : 'SELECT * FROM dharm_raksha_entries ORDER BY id DESC',
      req.user?.role === 'USER' ? [req.user.id] : []
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        nodeId: row.node_id,
        category: row.category,
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

dharmRakshaRouter.post('/', authMiddleware, (req: AuthRequest, res) => {
  const parsed = schema.safeParse(req.body);
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
    const id = await nextId('dr', 'dharm_raksha_entries');
    await db.query(
      `INSERT INTO dharm_raksha_entries (id, node_id, category, date, description, media_urls, assigned_user_ids)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, parsed.data.nodeId, parsed.data.category, parsed.data.date, parsed.data.description, parsed.data.mediaUrls ?? [], assignedUserIds]
    );
    res.status(201).json({ id, ...parsed.data, mediaUrls: parsed.data.mediaUrls ?? [], assignedUserIds });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

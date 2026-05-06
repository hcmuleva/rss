import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { db, nextId } from '../db';

export const activitiesRouter = Router();

const createActivitySchema = z.object({
  nodeId: z.string().min(1),
  category: z.string().min(1),
  date: z.string().min(1),
  description: z.string().min(2),
  maleOld: z.number().nonnegative(),
  maleYoung: z.number().nonnegative(),
  maleKids: z.number().nonnegative(),
  femaleOld: z.number().nonnegative(),
  femaleYoung: z.number().nonnegative(),
  femaleKids: z.number().nonnegative(),
  mediaUrls: z.array(z.string().url()).optional(),
  assignedUserIds: z.array(z.string().min(1)).optional()
});

activitiesRouter.get('/', authMiddleware, (req: AuthRequest, res) => {
  void (async () => {
    const { rows } = await db.query<{
      id: string;
      node_id: string;
      category: string;
      date: string;
      description: string;
      male_old: number;
      male_young: number;
      male_kids: number;
      female_old: number;
      female_young: number;
      female_kids: number;
      media_urls: string[];
      assigned_user_ids: string[];
    }>(
      req.user?.role === 'USER'
        ? 'SELECT * FROM activities WHERE $1 = ANY(assigned_user_ids) ORDER BY id DESC'
        : 'SELECT * FROM activities ORDER BY id DESC',
      req.user?.role === 'USER' ? [req.user.id] : []
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        nodeId: row.node_id,
        category: row.category,
        date: row.date,
        description: row.description,
        maleOld: row.male_old,
        maleYoung: row.male_young,
        maleKids: row.male_kids,
        femaleOld: row.female_old,
        femaleYoung: row.female_young,
        femaleKids: row.female_kids,
        mediaUrls: row.media_urls,
        assignedUserIds: row.assigned_user_ids
      }))
    );
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

activitiesRouter.post('/', authMiddleware, (req: AuthRequest, res) => {
  const parsed = createActivitySchema.safeParse(req.body);
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
    const id = await nextId('a', 'activities');
    await db.query(
      `INSERT INTO activities
       (id, node_id, category, date, description, male_old, male_young, male_kids, female_old, female_young, female_kids, assigned_user_ids, media_urls)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        id,
        parsed.data.nodeId,
        parsed.data.category,
        parsed.data.date,
        parsed.data.description,
        parsed.data.maleOld,
        parsed.data.maleYoung,
        parsed.data.maleKids,
        parsed.data.femaleOld,
        parsed.data.femaleYoung,
        parsed.data.femaleKids,
        assignedUserIds,
        parsed.data.mediaUrls ?? []
      ]
    );
    res.status(201).json({ id, ...parsed.data, mediaUrls: parsed.data.mediaUrls ?? [], assignedUserIds });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

activitiesRouter.get('/:id', authMiddleware, (req: AuthRequest, res) => {
  void (async () => {
    const { rows } = await db.query<{
      id: string;
      node_id: string;
      category: string;
      date: string;
      description: string;
      male_old: number;
      male_young: number;
      male_kids: number;
      female_old: number;
      female_young: number;
      female_kids: number;
      media_urls: string[];
      assigned_user_ids: string[];
    }>('SELECT * FROM activities WHERE id = $1 LIMIT 1', [req.params.id]);
    const entry = rows[0];
    if (!entry) {
      res.status(404).json({ message: 'Activity not found' });
      return;
    }
    if (req.user?.role === 'USER' && !entry.assigned_user_ids.includes(req.user.id)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    res.json({
      id: entry.id,
      nodeId: entry.node_id,
      category: entry.category,
      date: entry.date,
      description: entry.description,
      maleOld: entry.male_old,
      maleYoung: entry.male_young,
      maleKids: entry.male_kids,
      femaleOld: entry.female_old,
      femaleYoung: entry.female_young,
      femaleKids: entry.female_kids,
      mediaUrls: entry.media_urls,
      assignedUserIds: entry.assigned_user_ids
    });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

activitiesRouter.patch('/:id', authMiddleware, (req: AuthRequest, res) => {
  const parsed = createActivitySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }

  void (async () => {
    const existing = await db.query<{ assigned_user_ids: string[] }>(
      'SELECT assigned_user_ids FROM activities WHERE id = $1 LIMIT 1',
      [req.params.id]
    );
    const entry = existing.rows[0];
    if (!entry) {
      res.status(404).json({ message: 'Activity not found' });
      return;
    }
    if (req.user?.role === 'USER' && !entry.assigned_user_ids.includes(req.user.id)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    const assignedUserIds =
      req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN'
        ? (parsed.data.assignedUserIds?.length ? parsed.data.assignedUserIds : entry.assigned_user_ids)
        : entry.assigned_user_ids;

    const updated = await db.query<{
      id: string;
      node_id: string;
      category: string;
      date: string;
      description: string;
      male_old: number;
      male_young: number;
      male_kids: number;
      female_old: number;
      female_young: number;
      female_kids: number;
      media_urls: string[];
      assigned_user_ids: string[];
    }>(
      `UPDATE activities
       SET node_id = $1,
           category = $2,
           date = $3,
           description = $4,
           male_old = $5,
           male_young = $6,
           male_kids = $7,
           female_old = $8,
           female_young = $9,
           female_kids = $10,
           assigned_user_ids = $11,
           media_urls = $12
       WHERE id = $13
       RETURNING *`,
      [
        parsed.data.nodeId,
        parsed.data.category,
        parsed.data.date,
        parsed.data.description,
        parsed.data.maleOld,
        parsed.data.maleYoung,
        parsed.data.maleKids,
        parsed.data.femaleOld,
        parsed.data.femaleYoung,
        parsed.data.femaleKids,
        assignedUserIds,
        parsed.data.mediaUrls ?? [],
        req.params.id
      ]
    );
    const row = updated.rows[0];
    res.json({
      id: row.id,
      nodeId: row.node_id,
      category: row.category,
      date: row.date,
      description: row.description,
      maleOld: row.male_old,
      maleYoung: row.male_young,
      maleKids: row.male_kids,
      femaleOld: row.female_old,
      femaleYoung: row.female_young,
      femaleKids: row.female_kids,
      mediaUrls: row.media_urls,
      assignedUserIds: row.assigned_user_ids
    });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

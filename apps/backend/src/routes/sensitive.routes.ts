import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { db, nextId } from '../db';

export const sensitiveRouter = Router();

const createSensitiveSchema = z.object({
  nodeId: z.string().min(1),
  fromType: z.string().min(1),
  toType: z.string().min(1),
  date: z.string().min(1),
  isPartial: z.boolean(),
  hinduCount: z.number().optional(),
  convertedCount: z.number().optional(),
  status: z.enum(['Assigned', 'Delayed', 'NotStarted', 'Completed', 'NotReady', 'OnHold']),
  address: z.string().min(2),
  mediaUrls: z.array(z.string().url()).optional(),
  assignedUserIds: z.array(z.string().min(1)).optional()
});

sensitiveRouter.get('/', authMiddleware, (req: AuthRequest, res) => {
  void (async () => {
    const { rows } = await db.query<{
      id: string;
      node_id: string;
      from_type: string;
      to_type: string;
      date: string;
      is_partial: boolean;
      hindu_count: number | null;
      converted_count: number | null;
      status: 'Assigned' | 'Delayed' | 'NotStarted' | 'Completed' | 'NotReady' | 'OnHold';
      address: string;
      media_urls: string[];
      assigned_user_ids: string[];
    }>(
      req.user?.role === 'USER'
        ? 'SELECT * FROM sensitive_entries WHERE $1 = ANY(assigned_user_ids) ORDER BY id DESC'
        : 'SELECT * FROM sensitive_entries ORDER BY id DESC',
      req.user?.role === 'USER' ? [req.user.id] : []
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        nodeId: row.node_id,
        fromType: row.from_type,
        toType: row.to_type,
        date: row.date,
        isPartial: row.is_partial,
        hinduCount: row.hindu_count ?? undefined,
        convertedCount: row.converted_count ?? undefined,
        status: row.status,
        address: row.address,
        mediaUrls: row.media_urls,
        assignedUserIds: row.assigned_user_ids
      }))
    );
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

sensitiveRouter.post('/', authMiddleware, (req: AuthRequest, res) => {
  const parsed = createSensitiveSchema.safeParse(req.body);
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
    const id = await nextId('s', 'sensitive_entries');
    await db.query(
      `INSERT INTO sensitive_entries
        (id, node_id, from_type, to_type, date, is_partial, hindu_count, converted_count, status, address, assigned_user_ids, media_urls)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        parsed.data.nodeId,
        parsed.data.fromType,
        parsed.data.toType,
        parsed.data.date,
        parsed.data.isPartial,
        parsed.data.hinduCount ?? null,
        parsed.data.convertedCount ?? null,
        parsed.data.status,
        parsed.data.address,
        assignedUserIds,
        parsed.data.mediaUrls ?? []
      ]
    );
    res.status(201).json({ id, ...parsed.data, mediaUrls: parsed.data.mediaUrls ?? [], assignedUserIds });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

sensitiveRouter.get('/:id', authMiddleware, (req: AuthRequest, res) => {
  void (async () => {
    const { rows } = await db.query<{
      id: string;
      node_id: string;
      from_type: string;
      to_type: string;
      date: string;
      is_partial: boolean;
      hindu_count: number | null;
      converted_count: number | null;
      status: 'Assigned' | 'Delayed' | 'NotStarted' | 'Completed' | 'NotReady' | 'OnHold';
      address: string;
      media_urls: string[];
      assigned_user_ids: string[];
    }>('SELECT * FROM sensitive_entries WHERE id = $1 LIMIT 1', [req.params.id]);
    const row = rows[0];
    if (!row) {
      res.status(404).json({ message: 'Sensitive entry not found' });
      return;
    }
    if (req.user?.role === 'USER' && !row.assigned_user_ids.includes(req.user.id)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    res.json({
      id: row.id,
      nodeId: row.node_id,
      fromType: row.from_type,
      toType: row.to_type,
      date: row.date,
      isPartial: row.is_partial,
      hinduCount: row.hindu_count ?? undefined,
      convertedCount: row.converted_count ?? undefined,
      status: row.status,
      address: row.address,
      mediaUrls: row.media_urls,
      assignedUserIds: row.assigned_user_ids
    });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

sensitiveRouter.patch('/:id', authMiddleware, (req: AuthRequest, res) => {
  const parsed = createSensitiveSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }

  void (async () => {
    const existing = await db.query<{ assigned_user_ids: string[] }>(
      'SELECT assigned_user_ids FROM sensitive_entries WHERE id = $1 LIMIT 1',
      [req.params.id]
    );
    const row = existing.rows[0];
    if (!row) {
      res.status(404).json({ message: 'Sensitive entry not found' });
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
      node_id: string;
      from_type: string;
      to_type: string;
      date: string;
      is_partial: boolean;
      hindu_count: number | null;
      converted_count: number | null;
      status: 'Assigned' | 'Delayed' | 'NotStarted' | 'Completed' | 'NotReady' | 'OnHold';
      address: string;
      media_urls: string[];
      assigned_user_ids: string[];
    }>(
      `UPDATE sensitive_entries
       SET node_id = $1,
           from_type = $2,
           to_type = $3,
           date = $4,
           is_partial = $5,
           hindu_count = $6,
           converted_count = $7,
           status = $8,
           address = $9,
           assigned_user_ids = $10,
           media_urls = $11
       WHERE id = $12
       RETURNING *`,
      [
        parsed.data.nodeId,
        parsed.data.fromType,
        parsed.data.toType,
        parsed.data.date,
        parsed.data.isPartial,
        parsed.data.hinduCount ?? null,
        parsed.data.convertedCount ?? null,
        parsed.data.status,
        parsed.data.address,
        assignedUserIds,
        parsed.data.mediaUrls ?? [],
        req.params.id
      ]
    );
    const next = updated.rows[0];
    res.json({
      id: next.id,
      nodeId: next.node_id,
      fromType: next.from_type,
      toType: next.to_type,
      date: next.date,
      isPartial: next.is_partial,
      hinduCount: next.hindu_count ?? undefined,
      convertedCount: next.converted_count ?? undefined,
      status: next.status,
      address: next.address,
      mediaUrls: next.media_urls,
      assignedUserIds: next.assigned_user_ids
    });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

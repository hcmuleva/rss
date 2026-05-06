import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { db, nextId } from '../db';

export const masterlistsRouter = Router();

const createMasterListSchema = z.object({
  listType: z.enum(['ConversionFrom', 'ConversionTo', 'ProjectCategories', 'MatraShaktiType', 'VidhiAayamTeam']),
  name_hi: z.string().min(2),
  name_en: z.string().min(2)
});

masterlistsRouter.get('/', authMiddleware, (_req, res) => {
  void (async () => {
    const { rows } = await db.query<{
      id: string;
      list_type: 'ConversionFrom' | 'ConversionTo' | 'ProjectCategories' | 'MatraShaktiType' | 'VidhiAayamTeam';
      name_hi: string;
      name_en: string;
    }>('SELECT id, list_type, name_hi, name_en FROM master_lists ORDER BY id');
    res.json(
      rows.map((row) => ({
        id: row.id,
        listType: row.list_type,
        name_hi: row.name_hi,
        name_en: row.name_en
      }))
    );
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

masterlistsRouter.post('/', authMiddleware, (req: AuthRequest, res) => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ message: 'Only super admin can create master list items' });
    return;
  }

  const parsed = createMasterListSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }

  void (async () => {
    const id = await nextId('ml', 'master_lists');
    await db.query(
      'INSERT INTO master_lists (id, list_type, name_hi, name_en) VALUES ($1, $2, $3, $4)',
      [id, parsed.data.listType, parsed.data.name_hi, parsed.data.name_en]
    );
    res.status(201).json({ id, ...parsed.data });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

masterlistsRouter.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  if (req.user?.role !== 'SUPER_ADMIN') {
    res.status(403).json({ message: 'Only super admin can delete master list items' });
    return;
  }

  void (async () => {
    const deleted = await db.query<{
      id: string;
      list_type: string;
      name_hi: string;
      name_en: string;
    }>(
      'DELETE FROM master_lists WHERE id = $1 RETURNING id, list_type, name_hi, name_en',
      [req.params.id]
    );
    const row = deleted.rows[0];
    if (!row) {
      res.status(404).json({ message: 'Master list item not found' });
      return;
    }
    res.json({ id: row.id, listType: row.list_type, name_hi: row.name_hi, name_en: row.name_en });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

import { Router } from 'express';
import { z } from 'zod';

import { authMiddleware } from '../middleware/auth';
import { db, nextId } from '../db';

export const hierarchyRouter = Router();

hierarchyRouter.get('/nodes', authMiddleware, (_req, res) => {
  void (async () => {
    const { rows } = await db.query<{
      id: string;
      name_hi: string;
      name_en: string;
      level: string;
      branch: 'rural' | 'urban';
      parent_id: string | null;
      address: string;
      address_details: {
        villageOrMohalla: string;
        tehsil: string;
        district: string;
        state: string;
        country: string;
        pincode: string;
      } | null;
      lat: number;
      long: number;
    }>('SELECT id, name_hi, name_en, level, branch, parent_id, address, address_details, lat, long FROM hierarchy_nodes ORDER BY id');
    res.json(
      rows.map((row) => ({
        id: row.id,
        name_hi: row.name_hi,
        name_en: row.name_en,
        level: row.level,
        branch: row.branch,
        parentId: row.parent_id,
        address: row.address,
        addressDetails: row.address_details ?? undefined,
        lat: Number(row.lat),
        long: Number(row.long)
      }))
    );
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

const createHierarchySchema = z.object({
  name_hi: z.string().min(2),
  name_en: z.string().min(2),
  level: z.string().min(2),
  branch: z.enum(['rural', 'urban']),
  parentId: z.string().nullable(),
  address: z.string().min(2),
  addressDetails: z.object({
    villageOrMohalla: z.string().min(2),
    tehsil: z.string().min(2),
    district: z.string().min(2),
    state: z.string().min(2),
    country: z.string().min(2),
    pincode: z.string().min(4)
  }),
  lat: z.number(),
  long: z.number()
});

hierarchyRouter.post('/nodes', authMiddleware, (req, res) => {
  const parsed = createHierarchySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }

  void (async () => {
    if (parsed.data.parentId) {
      const parent = await db.query<{ id: string }>('SELECT id FROM hierarchy_nodes WHERE id = $1 LIMIT 1', [parsed.data.parentId]);
      if (parent.rows.length === 0) {
        res.status(404).json({ message: 'Parent node not found' });
        return;
      }
    }

    const id = await nextId('h', 'hierarchy_nodes');
    await db.query(
      `INSERT INTO hierarchy_nodes
        (id, name_hi, name_en, level, branch, parent_id, address, address_details, lat, long)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id,
        parsed.data.name_hi,
        parsed.data.name_en,
        parsed.data.level,
        parsed.data.branch,
        parsed.data.parentId,
        parsed.data.address,
        parsed.data.addressDetails,
        parsed.data.lat,
        parsed.data.long
      ]
    );
    res.status(201).json({ id, ...parsed.data });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

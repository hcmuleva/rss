import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { db, nextId } from '../db';

export const ayamRouter = Router();

const createAyamEntrySchema = z.object({
  subCategory: z.string().min(2),
  nodeId: z.string().min(1),
  description: z.string().min(2),
  workedFor: z.string().min(2),
  whoWorked: z.string().min(2),
  date: z.string().min(1),
  mediaUrls: z.array(z.string().url()).optional(),
  documentUrls: z.array(z.string().url()).optional(),
  assignedUserIds: z.array(z.string().min(1)).optional()
});

const createAyamMemberSchema = z.object({
  subCategory: z.enum(['Nidhi', 'Sanskriti', 'MatraShakti', 'Vidhi Aayam']),
  nodeId: z.string().min(1),
  memberType: z.string().optional(),
  name: z.string().min(2),
  guardianName: z.string().min(2),
  maritalStatus: z.enum(['Single', 'Married', 'Widowed', 'Other']),
  dob: z.string().min(1),
  address: z.string().min(2),
  addressDetails: z
    .object({
      villageOrMohalla: z.string().optional(),
      tehsil: z.string().optional(),
      district: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      pincode: z.string().optional()
    })
    .optional(),
  photoUrl: z.string().url().optional(),
  assignedUserIds: z.array(z.string().min(1)).optional()
});

const updateAyamMemberStatusSchema = z.object({
  isActive: z.boolean()
});

const validateMemberTypeBySubCategory = (
  subCategory: 'Nidhi' | 'Sanskriti' | 'MatraShakti' | 'Vidhi Aayam',
  memberType?: string
): string | null => {
  if (subCategory === 'Nidhi') {
    if (memberType && memberType !== 'DONOR') {
      return 'Nidhi member type must be DONOR';
    }
    return null;
  }
  if (subCategory === 'Sanskriti') {
    const allowed = new Set(['Sant', 'Saphakar', 'Badwa', 'Pujari', 'Bhagat']);
    if (!memberType || !allowed.has(memberType)) {
      return 'Invalid Sanskriti member type';
    }
    return null;
  }
  if (subCategory === 'MatraShakti' || subCategory === 'Vidhi Aayam') {
    if (!memberType) {
      return 'Member type is required for this sub-category';
    }
  }
  return null;
};

ayamRouter.get('/', authMiddleware, (req: AuthRequest, res) => {
  void (async () => {
    const { rows } = await db.query<{
      id: string;
      sub_category: string;
      node_id: string;
      description: string;
      worked_for: string;
      who_worked: string;
      date: string;
      media_urls: string[];
      document_urls: string[];
      assigned_user_ids: string[];
    }>(
      req.user?.role === 'USER'
        ? 'SELECT * FROM ayam_entries WHERE $1 = ANY(assigned_user_ids) ORDER BY id DESC'
        : 'SELECT * FROM ayam_entries ORDER BY id DESC',
      req.user?.role === 'USER' ? [req.user.id] : []
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        subCategory: row.sub_category,
        nodeId: row.node_id,
        description: row.description,
        workedFor: row.worked_for,
        whoWorked: row.who_worked,
        date: row.date,
        mediaUrls: row.media_urls,
        documentUrls: row.document_urls,
        assignedUserIds: row.assigned_user_ids
      }))
    );
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

ayamRouter.post('/', authMiddleware, (req: AuthRequest, res) => {
  const parsed = createAyamEntrySchema.safeParse(req.body);
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

    const id = await nextId('ay', 'ayam_entries');
    await db.query(
      `INSERT INTO ayam_entries
       (id, sub_category, node_id, description, worked_for, who_worked, date, assigned_user_ids, media_urls, document_urls)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, parsed.data.subCategory, parsed.data.nodeId, parsed.data.description, parsed.data.workedFor, parsed.data.whoWorked, parsed.data.date, assignedUserIds, parsed.data.mediaUrls ?? [], parsed.data.documentUrls ?? []]
    );
    res.status(201).json({ id, ...parsed.data, mediaUrls: parsed.data.mediaUrls ?? [], documentUrls: parsed.data.documentUrls ?? [], assignedUserIds });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

ayamRouter.get('/members', authMiddleware, (req: AuthRequest, res) => {
  void (async () => {
    const subCategory = typeof req.query.subCategory === 'string' ? req.query.subCategory : null;
    const isUser = req.user?.role === 'USER';
    const { rows } = await db.query<{
      id: string;
      sub_category: 'Nidhi' | 'Sanskriti' | 'MatraShakti' | 'Vidhi Aayam';
      node_id: string;
      member_type: string | null;
      name: string;
      guardian_name: string;
      marital_status: 'Single' | 'Married' | 'Widowed' | 'Other';
      dob: string;
      address: string;
      address_details: {
        villageOrMohalla?: string;
        tehsil?: string;
        district?: string;
        state?: string;
        country?: string;
        pincode?: string;
      } | null;
      photo_url: string | null;
      is_active: boolean;
      assigned_user_ids: string[];
    }>(
      `SELECT * FROM ayam_members
       WHERE ($1::text IS NULL OR sub_category = $1)
         AND ($2::text IS NULL OR $2 = ANY(assigned_user_ids))
         AND ($3::boolean OR is_active = TRUE)
       ORDER BY id DESC`,
      [subCategory, isUser ? req.user?.id ?? null : null, !isUser]
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        subCategory: row.sub_category,
        nodeId: row.node_id,
        memberType: row.member_type ?? undefined,
        name: row.name,
        guardianName: row.guardian_name,
        maritalStatus: row.marital_status,
        dob: row.dob,
        address: row.address,
        addressDetails: row.address_details ?? undefined,
        photoUrl: row.photo_url ?? undefined,
        isActive: row.is_active,
        assignedUserIds: row.assigned_user_ids
      }))
    );
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

ayamRouter.post('/members', authMiddleware, (req: AuthRequest, res) => {
  const parsed = createAyamMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }
  const memberTypeError = validateMemberTypeBySubCategory(parsed.data.subCategory, parsed.data.memberType);
  if (memberTypeError) {
    res.status(400).json({ message: memberTypeError });
    return;
  }

  void (async () => {
    const actorId = req.user?.id ?? 'u-unknown';
    const assignedUserIds =
      req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN'
        ? (parsed.data.assignedUserIds?.length ? parsed.data.assignedUserIds : [actorId])
        : [actorId];
    const id = await nextId('am', 'ayam_members');
    await db.query(
      `INSERT INTO ayam_members
      (id, sub_category, node_id, member_type, name, guardian_name, marital_status, dob, address, address_details, photo_url, is_active, assigned_user_ids)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        id,
        parsed.data.subCategory,
        parsed.data.nodeId,
        parsed.data.memberType ?? (parsed.data.subCategory === 'Nidhi' ? 'DONOR' : null),
        parsed.data.name,
        parsed.data.guardianName,
        parsed.data.maritalStatus,
        parsed.data.dob,
        parsed.data.address,
        parsed.data.addressDetails ?? null,
        parsed.data.photoUrl ?? null,
        true,
        assignedUserIds
      ]
    );
    res.status(201).json({ id, ...parsed.data, memberType: parsed.data.memberType ?? (parsed.data.subCategory === 'Nidhi' ? 'DONOR' : undefined), isActive: true, assignedUserIds });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

ayamRouter.patch('/members/:id', authMiddleware, (req: AuthRequest, res) => {
  const parsed = createAyamMemberSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }
  const memberTypeError = validateMemberTypeBySubCategory(parsed.data.subCategory, parsed.data.memberType);
  if (memberTypeError) {
    res.status(400).json({ message: memberTypeError });
    return;
  }
  void (async () => {
    const existing = await db.query<{ assigned_user_ids: string[]; is_active: boolean }>(
      'SELECT assigned_user_ids, is_active FROM ayam_members WHERE id = $1 LIMIT 1',
      [req.params.id]
    );
    const member = existing.rows[0];
    if (!member) {
      res.status(404).json({ message: 'Ayam member not found' });
      return;
    }
    if (req.user?.role === 'USER' && !member.assigned_user_ids.includes(req.user.id)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    const assignedUserIds =
      req.user?.role === 'ADMIN' || req.user?.role === 'SUPER_ADMIN'
        ? (parsed.data.assignedUserIds?.length ? parsed.data.assignedUserIds : member.assigned_user_ids)
        : member.assigned_user_ids;
    const { rows } = await db.query<{
      id: string;
      sub_category: 'Nidhi' | 'Sanskriti' | 'MatraShakti' | 'Vidhi Aayam';
      node_id: string;
      member_type: string | null;
      name: string;
      guardian_name: string;
      marital_status: 'Single' | 'Married' | 'Widowed' | 'Other';
      dob: string;
      address: string;
      address_details: {
        villageOrMohalla?: string;
        tehsil?: string;
        district?: string;
        state?: string;
        country?: string;
        pincode?: string;
      } | null;
      photo_url: string | null;
      is_active: boolean;
      assigned_user_ids: string[];
    }>(
      `UPDATE ayam_members
       SET sub_category=$1, node_id=$2, member_type=$3, name=$4, guardian_name=$5, marital_status=$6, dob=$7, address=$8, address_details=$9, photo_url=$10, assigned_user_ids=$11
       WHERE id=$12
       RETURNING *`,
      [
        parsed.data.subCategory,
        parsed.data.nodeId,
        parsed.data.memberType ?? (parsed.data.subCategory === 'Nidhi' ? 'DONOR' : null),
        parsed.data.name,
        parsed.data.guardianName,
        parsed.data.maritalStatus,
        parsed.data.dob,
        parsed.data.address,
        parsed.data.addressDetails ?? null,
        parsed.data.photoUrl ?? null,
        assignedUserIds,
        req.params.id
      ]
    );
    const row = rows[0];
    res.json({
      id: row.id,
      subCategory: row.sub_category,
      nodeId: row.node_id,
      memberType: row.member_type ?? undefined,
      name: row.name,
      guardianName: row.guardian_name,
      maritalStatus: row.marital_status,
      dob: row.dob,
      address: row.address,
      addressDetails: row.address_details ?? undefined,
      photoUrl: row.photo_url ?? undefined,
      isActive: row.is_active,
      assignedUserIds: row.assigned_user_ids
    });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

ayamRouter.patch('/members/:id/status', authMiddleware, (req: AuthRequest, res) => {
  if (req.user?.role === 'USER') {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  const parsed = updateAyamMemberStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }
  void (async () => {
    const { rows } = await db.query<{
      id: string;
      is_active: boolean;
    }>('UPDATE ayam_members SET is_active = $1 WHERE id = $2 RETURNING id, is_active', [parsed.data.isActive, req.params.id]);
    const row = rows[0];
    if (!row) {
      res.status(404).json({ message: 'Ayam member not found' });
      return;
    }
    res.json({ id: row.id, isActive: row.is_active });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

ayamRouter.delete('/members/:id', authMiddleware, (req: AuthRequest, res) => {
  if (req.user?.role === 'USER') {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  void (async () => {
    const { rows } = await db.query<{ id: string }>('DELETE FROM ayam_members WHERE id = $1 RETURNING id', [req.params.id]);
    const row = rows[0];
    if (!row) {
      res.status(404).json({ message: 'Ayam member not found' });
      return;
    }
    res.json({ id: row.id });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

ayamRouter.get('/:id', authMiddleware, (req: AuthRequest, res) => {
  void (async () => {
    const { rows } = await db.query<{
      id: string;
      sub_category: string;
      node_id: string;
      description: string;
      worked_for: string;
      who_worked: string;
      date: string;
      media_urls: string[];
      document_urls: string[];
      assigned_user_ids: string[];
    }>('SELECT * FROM ayam_entries WHERE id = $1 LIMIT 1', [req.params.id]);
    const entry = rows[0];
    if (!entry) {
      res.status(404).json({ message: 'Ayam entry not found' });
      return;
    }
    if (req.user?.role === 'USER' && !entry.assigned_user_ids.includes(req.user.id)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    res.json({
      id: entry.id,
      subCategory: entry.sub_category,
      nodeId: entry.node_id,
      description: entry.description,
      workedFor: entry.worked_for,
      whoWorked: entry.who_worked,
      date: entry.date,
      mediaUrls: entry.media_urls,
      documentUrls: entry.document_urls,
      assignedUserIds: entry.assigned_user_ids
    });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

ayamRouter.patch('/:id', authMiddleware, (req: AuthRequest, res) => {
  const parsed = createAyamEntrySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }

  void (async () => {
    const existing = await db.query<{ assigned_user_ids: string[] }>(
      'SELECT assigned_user_ids FROM ayam_entries WHERE id = $1 LIMIT 1',
      [req.params.id]
    );
    const entry = existing.rows[0];
    if (!entry) {
      res.status(404).json({ message: 'Ayam entry not found' });
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
      sub_category: string;
      node_id: string;
      description: string;
      worked_for: string;
      who_worked: string;
      date: string;
      media_urls: string[];
      document_urls: string[];
      assigned_user_ids: string[];
    }>(
      `UPDATE ayam_entries
       SET sub_category = $1,
           node_id = $2,
           description = $3,
           worked_for = $4,
           who_worked = $5,
           date = $6,
           assigned_user_ids = $7,
           media_urls = $8,
           document_urls = $9
       WHERE id = $10
       RETURNING *`,
      [parsed.data.subCategory, parsed.data.nodeId, parsed.data.description, parsed.data.workedFor, parsed.data.whoWorked, parsed.data.date, assignedUserIds, parsed.data.mediaUrls ?? [], parsed.data.documentUrls ?? [], req.params.id]
    );
    const row = updated.rows[0];
    res.json({
      id: row.id,
      subCategory: row.sub_category,
      nodeId: row.node_id,
      description: row.description,
      workedFor: row.worked_for,
      whoWorked: row.who_worked,
      date: row.date,
      mediaUrls: row.media_urls,
      documentUrls: row.document_urls,
      assignedUserIds: row.assigned_user_ids
    });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

ayamRouter.get('/vanshavali/nodes', authMiddleware, (_req, res) => {
  void (async () => {
    const { rows } = await db.query<{
      id: string;
      parent_id: string | null;
      name: string;
      dates: {
        from?: string;
        till?: string;
      };
      religion: string;
      caste: string;
      gotra: string;
      photo: string | null;
    }>('SELECT id, parent_id, name, dates, religion, caste, gotra, photo FROM vanshavali_nodes ORDER BY id');
    const childMap = new Map<string, string[]>();
    rows.forEach((row) => {
      if (!row.parent_id) {
        return;
      }
      const children = childMap.get(row.parent_id) ?? [];
      children.push(row.id);
      childMap.set(row.parent_id, children);
    });
    res.json(
      rows.map((row) => ({
        id: row.id,
        parentId: row.parent_id,
        childrenIds: childMap.get(row.id) ?? [],
        photo: row.photo ?? undefined,
        name: row.name,
        dates: row.dates,
        religion: row.religion,
        caste: row.caste,
        gotra: row.gotra
      }))
    );
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

const createVanshavaliNodeSchema = z.object({
  parentId: z.string().nullable(),
  name: z.string().min(2),
  religion: z.string().min(2),
  caste: z.string().min(2),
  gotra: z.string().min(2),
  from: z.string().optional(),
  till: z.string().optional()
});

ayamRouter.post('/vanshavali/nodes', authMiddleware, (req, res) => {
  const parsed = createVanshavaliNodeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }

  void (async () => {
    if (parsed.data.parentId) {
      const parent = await db.query<{ id: string }>('SELECT id FROM vanshavali_nodes WHERE id = $1 LIMIT 1', [parsed.data.parentId]);
      if (parent.rows.length === 0) {
        res.status(404).json({ message: 'Parent node not found' });
        return;
      }
    }

    const id = await nextId('v', 'vanshavali_nodes');
    const dates = { from: parsed.data.from, till: parsed.data.till };
    await db.query(
      `INSERT INTO vanshavali_nodes (id, parent_id, name, dates, religion, caste, gotra, photo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, parsed.data.parentId, parsed.data.name, dates, parsed.data.religion, parsed.data.caste, parsed.data.gotra, null]
    );
    res.status(201).json({
      id,
      parentId: parsed.data.parentId,
      childrenIds: [],
      name: parsed.data.name,
      dates,
      religion: parsed.data.religion,
      caste: parsed.data.caste,
      gotra: parsed.data.gotra
    });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

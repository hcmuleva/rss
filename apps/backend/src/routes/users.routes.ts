import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';
import { db, nextId } from '../db';

export const usersRouter = Router();

const createUserSchema = z.object({
  name: z.string().min(2),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'USER']),
  assignedNodeId: z.string().min(1),
  isFullTime: z.boolean().optional()
});

const updateUserSchema = z.object({
  name: z.string().min(2),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  password: z.string().min(6).optional(),
  role: z.enum(['ADMIN', 'USER']),
  assignedNodeId: z.string().min(1),
  isFullTime: z.boolean().optional()
});

const updateUserStatusSchema = z.object({
  isActive: z.boolean()
});

usersRouter.get('/', authMiddleware, (_req, res) => {
  void (async () => {
    const { rows } = await db.query<{
      id: string;
      name: string;
      phone: string;
      role: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
      assigned_node_id: string;
      is_active: boolean;
      is_full_time: boolean;
    }>('SELECT id, name, phone, role, assigned_node_id, is_active, is_full_time FROM users ORDER BY id');
    res.json(
      rows.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        role: row.role,
        assignedNodeId: row.assigned_node_id,
        isActive: row.is_active,
        isFullTime: row.is_full_time
      }))
    );
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

usersRouter.post('/', authMiddleware, (req: AuthRequest, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }

  if (req.user?.role === 'ADMIN' && parsed.data.role !== 'USER') {
    res.status(403).json({ message: 'Admin can only create USER role' });
    return;
  }
  if (req.user?.role === 'USER') {
    res.status(403).json({ message: 'User cannot create users' });
    return;
  }

  void (async () => {
    const exists = await db.query<{ id: string }>('SELECT id FROM users WHERE phone = $1 LIMIT 1', [parsed.data.phone]);
    if (exists.rows.length > 0) {
      res.status(409).json({ message: 'Phone already exists' });
      return;
    }

    const id = await nextId('u', 'users');
    const isFullTime = parsed.data.isFullTime ?? false;
    await db.query(
      `INSERT INTO users (id, name, phone, password, role, assigned_node_id, is_active, is_full_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, parsed.data.name, parsed.data.phone, parsed.data.password, parsed.data.role, parsed.data.assignedNodeId, true, isFullTime]
    );

    res.status(201).json({
      id,
      name: parsed.data.name,
      phone: parsed.data.phone,
      role: parsed.data.role,
      assignedNodeId: parsed.data.assignedNodeId,
      isActive: true,
      isFullTime
    });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

usersRouter.patch('/:id/status', authMiddleware, (req: AuthRequest, res) => {
  const parsed = updateUserStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }

  if (req.user?.role === 'USER') {
    res.status(403).json({ message: 'User cannot update users' });
    return;
  }

  void (async () => {
    const updated = await db.query<{
      id: string;
      name: string;
      phone: string;
      role: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
      assigned_node_id: string;
      is_active: boolean;
      is_full_time: boolean;
    }>(
      `UPDATE users SET is_active = $1 WHERE id = $2
       RETURNING id, name, phone, role, assigned_node_id, is_active, is_full_time`,
      [parsed.data.isActive, req.params.id]
    );
    const user = updated.rows[0];
    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      assignedNodeId: user.assigned_node_id,
      isActive: user.is_active,
      isFullTime: user.is_full_time
    });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

usersRouter.patch('/:id', authMiddleware, (req: AuthRequest, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }

  if (req.user?.role === 'USER') {
    res.status(403).json({ message: 'User cannot update users' });
    return;
  }
  if (req.user?.role === 'ADMIN' && parsed.data.role !== 'USER') {
    res.status(403).json({ message: 'Admin can only manage USER role' });
    return;
  }

  void (async () => {
    const existingUser = await db.query<{ role: 'SUPER_ADMIN' | 'ADMIN' | 'USER' }>('SELECT role FROM users WHERE id = $1 LIMIT 1', [req.params.id]);
    if (!existingUser.rows[0]) {
      res.status(404).json({ message: 'User not found' });
      return;
    }
    if (req.user?.role === 'ADMIN' && existingUser.rows[0].role !== 'USER') {
      res.status(403).json({ message: 'Admin can only update USER role' });
      return;
    }

    const duplicate = await db.query<{ id: string }>('SELECT id FROM users WHERE phone = $1 AND id <> $2 LIMIT 1', [parsed.data.phone, req.params.id]);
    if (duplicate.rows.length > 0) {
      res.status(409).json({ message: 'Phone already exists' });
      return;
    }

    const user = await db.query<{
      id: string;
      name: string;
      phone: string;
      role: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
      assigned_node_id: string;
      is_active: boolean;
      is_full_time: boolean;
    }>(
      `UPDATE users
       SET name = $1,
           phone = $2,
           role = $3,
           assigned_node_id = $4,
           is_full_time = COALESCE($5, is_full_time),
           password = COALESCE($6, password)
       WHERE id = $7
       RETURNING id, name, phone, role, assigned_node_id, is_active, is_full_time`,
      [
        parsed.data.name,
        parsed.data.phone,
        parsed.data.role,
        parsed.data.assignedNodeId,
        parsed.data.isFullTime ?? null,
        parsed.data.password ?? null,
        req.params.id
      ]
    );

    const row = user.rows[0];
    res.json({
      id: row.id,
      name: row.name,
      phone: row.phone,
      role: row.role,
      assignedNodeId: row.assigned_node_id,
      isActive: row.is_active,
      isFullTime: row.is_full_time
    });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

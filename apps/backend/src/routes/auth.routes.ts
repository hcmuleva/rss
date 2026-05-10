import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { env } from '../config/env';
import { db, nextId } from '../db';

const loginSchema = z.object({
  phone: z
    .string()
    .min(3)
    .refine((value) => /^[6-9]\d{9}$/.test(value) || /^[a-zA-Z0-9_-]+$/.test(value), {
      message: 'Provide valid mobile number or user id'
    }),
  password: z.string().min(6)
});

const registerSchema = z.object({
  name: z.string().min(2),
  phone: z.string().regex(/^[6-9]\d{9}$/),
  password: z.string().min(6)
});

export const authRouter = Router();

authRouter.post('/register', (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }

  void (async () => {
    const existing = await db.query<{ id: string }>('SELECT id FROM users WHERE phone = $1 LIMIT 1', [parsed.data.phone]);
    if (existing.rows.length > 0) {
      res.status(409).json({ message: 'User already exists' });
      return;
    }

    const id = await nextId('u', 'users');
    const assignedNodeId = 'h-l5b3-1';
    await db.query(
      `INSERT INTO users (id, name, phone, password, role, assigned_node_id, is_active, is_full_time)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [id, parsed.data.name, parsed.data.phone, parsed.data.password, 'USER', assignedNodeId, true, false]
    );

    const token = jwt.sign({ id, role: 'USER', assignedNodeId, isFullTime: false }, env.jwtSecret);
    const refreshToken = jwt.sign({ id }, env.jwtRefreshSecret);
    res.json({ token, refreshToken, role: 'USER', userId: id, assignedNodeId, isFullTime: false });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

authRouter.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }

  void (async () => {
    const result = await db.query<{
      id: string;
      role: 'SUPER_ADMIN' | 'ADMIN' | 'USER';
      assigned_node_id: string;
      is_full_time: boolean;
    }>(
      `SELECT id, role, assigned_node_id, is_full_time FROM users
       WHERE (phone = $1 OR id = $1) AND password = $2 AND is_active = TRUE
       LIMIT 1`,
      [parsed.data.phone, parsed.data.password]
    );
    const user = result.rows[0];
    if (!user) {
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, assignedNodeId: user.assigned_node_id, isFullTime: user.is_full_time },
      env.jwtSecret
    );
    const refreshToken = jwt.sign({ id: user.id }, env.jwtRefreshSecret);
    res.json({
      token,
      refreshToken,
      role: user.role,
      userId: user.id,
      assignedNodeId: user.assigned_node_id,
      isFullTime: user.is_full_time
    });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

import { Router } from 'express';
import { z } from 'zod';

import { db, nextId } from '../db';
import type { AuthRequest } from '../middleware/auth';
import { authMiddleware } from '../middleware/auth';

export const assignmentsRouter = Router();

const assignmentSchema = z.object({
  moduleType: z.enum(['Sensitive', 'Activities', 'Project', 'Ayam', 'DharmRaksha', 'FullTime']),
  assignmentKey: z.string().min(1),
  nodeId: z.string().nullable().optional(),
  assignedUserIds: z.array(z.string().min(1)).min(1)
});

const getAllowedNodeIds = async (rootNodeId: string) => {
  const { rows } = await db.query<{ id: string }>(
    `WITH RECURSIVE node_tree AS (
      SELECT id, parent_id FROM hierarchy_nodes WHERE id = $1
      UNION ALL
      SELECT n.id, n.parent_id
      FROM hierarchy_nodes n
      JOIN node_tree nt ON n.parent_id = nt.id
    )
    SELECT id FROM node_tree`,
    [rootNodeId]
  );
  return new Set(rows.map((row) => row.id));
};

assignmentsRouter.get('/', authMiddleware, (req: AuthRequest, res) => {
  void (async () => {
    const isUser = req.user?.role === 'USER';
    const { rows } = await db.query<{
      id: string;
      module_type: 'Sensitive' | 'Activities' | 'Project' | 'Ayam' | 'DharmRaksha' | 'FullTime';
      assignment_key: string;
      node_id: string | null;
      assigned_user_ids: string[];
    }>(
      isUser
        ? 'SELECT * FROM module_assignments WHERE $1 = ANY(assigned_user_ids) ORDER BY module_type, assignment_key'
        : 'SELECT * FROM module_assignments ORDER BY module_type, assignment_key',
      isUser ? [req.user?.id ?? ''] : []
    );
    res.json(
      rows.map((row) => ({
        id: row.id,
        moduleType: row.module_type,
        assignmentKey: row.assignment_key,
        nodeId: row.node_id,
        assignedUserIds: row.assigned_user_ids
      }))
    );
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

assignmentsRouter.post('/', authMiddleware, (req: AuthRequest, res) => {
  if (req.user?.role === 'USER') {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  const parsed = assignmentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
    return;
  }

  void (async () => {
    const isAdmin = req.user?.role === 'ADMIN';
    const adminNodeId = req.user?.assignedNodeId ?? '';
    const allowedNodeIds = isAdmin ? await getAllowedNodeIds(adminNodeId) : null;
    const nodeId = isAdmin ? (parsed.data.nodeId ?? adminNodeId) : (parsed.data.nodeId ?? null);

    if (isAdmin && (!nodeId || !allowedNodeIds?.has(nodeId))) {
      res.status(403).json({ message: 'You can assign only within your hierarchy scope.' });
      return;
    }

    if (isAdmin) {
      const users = await db.query<{ id: string; assigned_node_id: string; role: 'SUPER_ADMIN' | 'ADMIN' | 'USER'; is_active: boolean }>(
        'SELECT id, assigned_node_id, role, is_active FROM users WHERE id = ANY($1::text[])',
        [parsed.data.assignedUserIds]
      );
      if (
        users.rows.length !== parsed.data.assignedUserIds.length ||
        users.rows.some((user) => user.role !== 'USER' || !user.is_active || !allowedNodeIds?.has(user.assigned_node_id))
      ) {
        res.status(403).json({ message: 'Some selected users are outside your hierarchy scope.' });
        return;
      }
    }

    const existing = await db.query<{ id: string }>(
      `SELECT id
       FROM module_assignments
       WHERE module_type = $1
         AND assignment_key = $2
         AND (
           ($3::text IS NULL AND node_id IS NULL)
           OR node_id = $3
         )
       LIMIT 1`,
      [parsed.data.moduleType, parsed.data.assignmentKey, nodeId]
    );
    const current = existing.rows[0];
    if (current) {
      const updated = await db.query<{
        id: string;
        module_type: 'Sensitive' | 'Activities' | 'Project' | 'Ayam' | 'DharmRaksha' | 'FullTime';
        assignment_key: string;
        node_id: string | null;
        assigned_user_ids: string[];
      }>(
        `UPDATE module_assignments
         SET assigned_user_ids = $1
         WHERE id = $2
         RETURNING *`,
        [parsed.data.assignedUserIds, current.id]
      );
      const row = updated.rows[0];
      res.json({
        id: row.id,
        moduleType: row.module_type,
        assignmentKey: row.assignment_key,
        nodeId: row.node_id,
        assignedUserIds: row.assigned_user_ids
      });
      return;
    }

    const id = await nextId('asg', 'module_assignments');
    const inserted = await db.query<{
      id: string;
      module_type: 'Sensitive' | 'Activities' | 'Project' | 'Ayam' | 'DharmRaksha' | 'FullTime';
      assignment_key: string;
      node_id: string | null;
      assigned_user_ids: string[];
    }>(
      `INSERT INTO module_assignments (id, module_type, assignment_key, node_id, assigned_user_ids)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [id, parsed.data.moduleType, parsed.data.assignmentKey, nodeId, parsed.data.assignedUserIds]
    );
    const row = inserted.rows[0];
    res.status(201).json({
      id: row.id,
      moduleType: row.module_type,
      assignmentKey: row.assignment_key,
      nodeId: row.node_id,
      assignedUserIds: row.assigned_user_ids
    });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

assignmentsRouter.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  if (req.user?.role === 'USER') {
    res.status(403).json({ message: 'Forbidden' });
    return;
  }
  void (async () => {
    const existing = await db.query<{ id: string; node_id: string | null }>(
      'SELECT id, node_id FROM module_assignments WHERE id = $1 LIMIT 1',
      [req.params.id]
    );
    const assignment = existing.rows[0];
    if (!assignment) {
      res.status(404).json({ message: 'Assignment not found' });
      return;
    }

    if (req.user?.role === 'ADMIN') {
      const allowedNodeIds = await getAllowedNodeIds(req.user.assignedNodeId);
      if (!assignment.node_id || !allowedNodeIds.has(assignment.node_id)) {
        res.status(403).json({ message: 'You can delete only assignments in your hierarchy scope.' });
        return;
      }
    }

    await db.query('DELETE FROM module_assignments WHERE id = $1', [req.params.id]);
    res.json({ id: req.params.id });
  })().catch((error: Error) => {
    res.status(500).json({ message: error.message });
  });
});

import { Router } from 'express';
import { z } from 'zod';

import { authMiddleware } from '../middleware/auth';
import { createPresignedUpload } from '../services/s3.service';

const schema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().min(1)
});

export const uploadsRouter = Router();

uploadsRouter.post('/presign', authMiddleware, async (req, res, next) => {
  try {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: 'Invalid payload', errors: parsed.error.format() });
      return;
    }

    const signed = await createPresignedUpload(parsed.data.fileName, parsed.data.contentType);
    res.json(signed);
  } catch (error) {
    next(error);
  }
});

import express from 'express';
import cors from 'cors';

import { env } from './config/env';
import { initDb } from './db/init';
import { apiRouter } from './routes';

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/api', apiRouter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use((err: Error, _req: express.Request, res: express.Response) => {
  res.status(500).json({ message: err.message });
});

const start = async () => {
  await initDb();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on ${env.port}`);
  });
};

void start();

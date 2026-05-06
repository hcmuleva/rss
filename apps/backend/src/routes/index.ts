import { Router } from 'express';

import { authRouter } from './auth.routes';
import { uploadsRouter } from './uploads.routes';
import { hierarchyRouter } from './hierarchy.routes';
import { usersRouter } from './users.routes';
import { sensitiveRouter } from './sensitive.routes';
import { activitiesRouter } from './activities.routes';
import { projectsRouter } from './projects.routes';
import { ayamRouter } from './ayam.routes';
import { masterlistsRouter } from './master-lists.routes';
import { fulltimeRouter } from './fulltime.routes';
import { dharmRakshaRouter } from './dharm-raksha.routes';
import { assignmentsRouter } from './assignments.routes';

export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/uploads', uploadsRouter);
apiRouter.use('/hierarchy', hierarchyRouter);
apiRouter.use('/users', usersRouter);
apiRouter.use('/sensitive', sensitiveRouter);
apiRouter.use('/activities', activitiesRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/ayam', ayamRouter);
apiRouter.use('/master-lists', masterlistsRouter);
apiRouter.use('/fulltime', fulltimeRouter);
apiRouter.use('/dharm-raksha', dharmRakshaRouter);
apiRouter.use('/assignments', assignmentsRouter);

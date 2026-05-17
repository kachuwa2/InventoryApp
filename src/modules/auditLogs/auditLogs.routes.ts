import { Router } from 'express';
import { getAll } from './auditLogs.controller';
import { authenticate } from '../../middleware/authentication';
import { authorize } from '../../middleware/authorize';

const router = Router();

router.use(authenticate);
router.get('/', authorize(['admin']), getAll);

export default router;

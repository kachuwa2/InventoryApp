import { Router } from 'express';
import {
  dashboard,
  profitLoss,
  topProducts,
  slowMoving,
} from './reports.controller';
import { authenticate } from '../../middleware/authentication';
import { authorize }    from '../../middleware/authorize';

const router = Router();

router.use(authenticate);

// Reports are restricted to admin and manager only —
// financial data is sensitive
router.use(authorize(['admin', 'manager']));

router.get('/dashboard',     dashboard);
router.get('/profit-loss',   profitLoss);
router.get('/top-products',  topProducts);
router.get('/slow-moving',   slowMoving);

export default router;
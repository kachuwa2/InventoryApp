import { Router } from 'express';
import {
  getStockLevels,
  getLowStock,
  getMovements,
  adjust,
  getValuation,
} from './inventory.controller';
import { authenticate }  from '../../middleware/authentication';
import { authorize }     from '../../middleware/authorize';
import { validate }      from '../../middleware/validate';
import {
  adjustStockSchema,
  productIdParamSchema,
} from './inventory.schema';

const router = Router();

router.use(authenticate);

// Stock levels — any logged in user can view
router.get('/', getStockLevels);
router.get('/low-stock', getLowStock);
router.get('/valuation', getValuation);

// Movement history for a specific product
router.get(
  '/:productId/movements',
  validate(productIdParamSchema),
  getMovements
);

// Manual adjustments — warehouse and above only
router.post(
  '/adjust',
  authorize(['admin', 'manager', 'warehouse']),
  validate(adjustStockSchema),
  adjust
);

export default router;
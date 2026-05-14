import { Router } from 'express';
import {
  getAll,
  getOne,
  createOne,
  dailySummary,
} from './sales.controller';
import { authenticate } from '../../middleware/authentication';
import { authorize }    from '../../middleware/authorize';
import { validate }     from '../../middleware/validate';
import {
  createSaleSchema,
  idParamSchema,
} from './sales.schema';

const router = Router();

router.use(authenticate);

// Daily summary must be before /:id
// same reason as barcode before /:id in products
router.get('/daily-summary', dailySummary);
router.get('/',              getAll);
router.get('/:id',           validate(idParamSchema), getOne);

// Cashier and above can create sales
router.post('/',
  authorize(['admin', 'manager', 'cashier']),
  validate(createSaleSchema),
  createOne
);

export default router;
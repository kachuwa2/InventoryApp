import { Router } from 'express';
import {
  getAll,
  getOne,
  createOne,
  updateOne,
  approve,
  receive,
  cancel,
} from './purchases.controller';
import { authenticate }  from '../../middleware/authentication';
import { authorize }     from '../../middleware/authorize';
import { validate }      from '../../middleware/validate';
import {
  createPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  receivePurchaseOrderSchema,
  idParamSchema,
} from './purchases.schema';

const router = Router();

router.use(authenticate);

// Any logged-in user can view purchase orders
router.get('/',    getAll);
router.get('/:id', validate(idParamSchema), getOne);

// Only admin and manager can create and update
router.post('/',
  authorize(['admin', 'manager']),
  validate(createPurchaseOrderSchema),
  createOne
);

router.put('/:id',
  authorize(['admin', 'manager']),
  validate(updatePurchaseOrderSchema),
  updateOne
);

// Approve — admin and manager only
router.post('/:id/approve',
  authorize(['admin', 'manager']),
  validate(idParamSchema),
  approve
);

// Receive stock — warehouse and above
// Warehouse staff physically receive the goods
router.post('/:id/receive',
  authorize(['admin', 'manager', 'warehouse']),
  validate(receivePurchaseOrderSchema),
  receive
);

// Cancel — admin and manager only
router.post('/:id/cancel',
  authorize(['admin', 'manager']),
  validate(idParamSchema),
  cancel
);

export default router;
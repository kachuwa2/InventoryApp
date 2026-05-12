import { Router } from 'express';
import * as suppliersController from './suppliers.controller';
import { authenticate } from '../../middleware/authentication';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import {
  createSupplierSchema,
  updateSupplierSchema,
  idParamSchema,
} from './suppliers.schema';

const router = Router();

// Every supplier route requires a valid login token
router.use(authenticate);

// Any logged-in user can view suppliers —
// a cashier might need to check who supplies a product
router.get('/',    suppliersController.getAll);
router.get('/:id', validate(idParamSchema), suppliersController.getOne);

// Only admin and manager can create, update, or delete
router.post(
  '/',
  authorize(['admin', 'manager']),
  validate(createSupplierSchema),
  suppliersController.create
);

router.put(
  '/:id',
  authorize(['admin', 'manager']),
  validate(updateSupplierSchema),
  suppliersController.update
);

router.delete(
  '/:id',
  authorize(['admin', 'manager']),
  validate(idParamSchema),
  suppliersController.remove
);

export default router;
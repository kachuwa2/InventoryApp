import { Router } from 'express';
import {
  getAll,
  getOne,
  createOne,
  updateOne,
  removeOne,
} from './customers.controller';
import { authenticate } from '../../middleware/authentication';
import { authorize }    from '../../middleware/authorize';
import { validate }     from '../../middleware/validate';
import {
  createCustomerSchema,
  updateCustomerSchema,
  idParamSchema,
} from './customers.schema';

const router = Router();

router.use(authenticate);

router.get('/',    getAll);
router.get('/:id', validate(idParamSchema), getOne);

router.post('/',
  authorize(['admin', 'manager', 'cashier']),
  validate(createCustomerSchema),
  createOne
);

router.put('/:id',
  authorize(['admin', 'manager', 'cashier']),
  validate(updateCustomerSchema),
  updateOne
);

router.delete('/:id',
  authorize(['admin', 'manager']),
  validate(idParamSchema),
  removeOne
);

export default router;
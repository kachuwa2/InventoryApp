import { Router } from 'express';
import {
  getAll,
  getOne,
  getByBarcode,
  createOne,
  updateOne,
  updateProductPrice,
  removeOne,
} from './products.controller';
import { authenticate }  from '../../middleware/authentication';
import { authorize }     from '../../middleware/authorize';
import { validate }      from '../../middleware/validate';
import {
  createProductSchema,
  updateProductSchema,
  updatePriceSchema,
  idParamSchema,
  barcodeParamSchema,
} from './products.schema';

const router = Router();

// All product routes require a valid login token
router.use(authenticate);

// Any logged-in user can view and search products.
// The barcode route must be defined BEFORE /:id
// because Express matches routes top to bottom —
// if /:id comes first, "/barcode/123" would be treated
// as an id lookup for "barcode" which is wrong.
router.get('/',
  getAll
);

router.get('/barcode/:code',
  validate(barcodeParamSchema),
  getByBarcode
);

router.get('/:id',
  validate(idParamSchema),
  getOne
);

// Only admin and manager can write product data
router.post('/',
  authorize(['admin', 'manager']),
  validate(createProductSchema),
  createOne
);

router.put('/:id',
  authorize(['admin', 'manager']),
  validate(updateProductSchema),
  updateOne
);

// Price update is a separate endpoint — changing a price
// is a deliberate business action that always creates
// a new record in product_price_history
router.put('/:id/price',
  authorize(['admin', 'manager']),
  validate(updatePriceSchema),
  updateProductPrice
);

router.delete('/:id',
  authorize(['admin', 'manager']),
  validate(idParamSchema),
  removeOne
);

export default router;
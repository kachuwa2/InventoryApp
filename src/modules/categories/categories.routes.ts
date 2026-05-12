import { Router } from 'express';
import * as categoriesController from './categories.controller';
import { authenticate } from '../../middleware/authentication';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import {
  createCategorySchema,
  updateCategorySchema,
  idParamSchema,
} from './categories.schema';

const router = Router();

// All category routes require authentication
router.use(authenticate);

// Anyone logged in can view categories
router.get('/',   categoriesController.getAll);
router.get('/:id', validate(idParamSchema), categoriesController.getOne);

// Only admin and manager can create, update, delete
router.post(
  '/',
  authorize(['admin', 'manager']),
  validate(createCategorySchema),
  categoriesController.create
);

router.put(
  '/:id',
  authorize(['admin', 'manager']),
  validate(updateCategorySchema),
  categoriesController.update
);

router.delete(
  '/:id',
  authorize(['admin', 'manager']),
  validate(idParamSchema),
  categoriesController.remove
);

export default router;
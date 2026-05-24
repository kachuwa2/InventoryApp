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
/**
 * @swagger
 * /api/categories:
 *   get:
 *     tags: [Categories]
 *     summary: List all categories
 *     description: Get a hierarchical list of all product categories with parent-child relationships.
 *     responses:
 *       200:
 *         description: Category list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Category'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/',   categoriesController.getAll);

/**
 * @swagger
 * /api/categories/{id}:
 *   get:
 *     tags: [Categories]
 *     summary: Get category by ID
 *     description: Retrieve a single category with its parent and children.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         example: 550e8400-e29b-41d4-a716-446655440000
 *     responses:
 *       200:
 *         description: Category detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', validate(idParamSchema), categoriesController.getOne);

// Only admin and manager can create, update, delete
/**
 * @swagger
 * /api/categories:
 *   post:
 *     tags: [Categories]
 *     summary: Create a new category
 *     description: Create a new product category. Restricted to admin and manager.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Cookware
 *               description:
 *                 type: string
 *                 nullable: true
 *                 example: Pots, pans, and cooking equipment
 *               parentId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Category created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post(
  '/',
  authorize(['admin', 'manager']),
  validate(createCategorySchema),
  categoriesController.create
);

/**
 * @swagger
 * /api/categories/{id}:
 *   put:
 *     tags: [Categories]
 *     summary: Update a category
 *     description: Update category name, description, or parent. Restricted to admin and manager.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, example: Cookware }
 *               description: { type: string, nullable: true }
 *               parentId: { type: string, format: uuid, nullable: true }
 *     responses:
 *       200:
 *         description: Category updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Category'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

router.put(
  '/:id',
  authorize(['admin', 'manager']),
  validate(updateCategorySchema),
  categoriesController.update
);

/**
 * @swagger
 * /api/categories/{id}:
 *   delete:
 *     tags: [Categories]
 *     summary: Delete a category
 *     description: |
 *       Soft-delete a category. The category will be marked as deleted but products will retain their references.
 *       Restricted to admin and manager.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Category deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data: { type: object, example: {} }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

export default router;
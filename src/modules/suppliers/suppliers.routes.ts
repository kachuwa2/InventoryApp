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
/**
 * @swagger
 * /api/suppliers:
 *   get:
 *     tags: [Suppliers]
 *     summary: List all suppliers
 *     description: Get all supplier records with product count.
 *     responses:
 *       200:
 *         description: Supplier list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Supplier'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/',    suppliersController.getAll);

/**
 * @swagger
 * /api/suppliers/{id}:
 *   get:
 *     tags: [Suppliers]
 *     summary: Get supplier by ID
 *     description: Retrieve a single supplier with their product list.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Supplier detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Supplier'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', validate(idParamSchema), suppliersController.getOne);

// Only admin and manager can create, update, or delete
/**
 * @swagger
 * /api/suppliers:
 *   post:
 *     tags: [Suppliers]
 *     summary: Create a new supplier
 *     description: Create a new supplier record. Restricted to admin and manager.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, contactPerson, phone, email, address]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Global Cookware Co.
 *               contactPerson:
 *                 type: string
 *                 example: David Mwangi
 *               phone:
 *                 type: string
 *                 example: "+254 712 345 678"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: david@globalcookware.com
 *               address:
 *                 type: string
 *                 example: Industrial Area, Nairobi
 *               creditLimit:
 *                 type: string
 *                 example: "50000.00"
 *     responses:
 *       201:
 *         description: Supplier created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Supplier'
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
  validate(createSupplierSchema),
  suppliersController.create
);

/**
 * @swagger
 * /api/suppliers/{id}:
 *   put:
 *     tags: [Suppliers]
 *     summary: Update a supplier
 *     description: Update supplier details. Restricted to admin and manager.
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
 *               name: { type: string }
 *               contactPerson: { type: string }
 *               phone: { type: string }
 *               email: { type: string, format: email }
 *               address: { type: string }
 *               creditLimit: { type: string }
 *     responses:
 *       200:
 *         description: Supplier updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Supplier'
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
  validate(updateSupplierSchema),
  suppliersController.update
);

/**
 * @swagger
 * /api/suppliers/{id}:
 *   delete:
 *     tags: [Suppliers]
 *     summary: Delete a supplier
 *     description: Soft-delete a supplier. Restricted to admin and manager.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Supplier deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

export default router;
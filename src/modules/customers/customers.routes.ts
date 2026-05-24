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

/**
 * @swagger
 * /api/customers:
 *   get:
 *     tags: [Customers]
 *     summary: List customers
 *     description: Get all customer records with optional filtering by type.
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [retail, wholesale] }
 *     responses:
 *       200:
 *         description: Customer list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Customer'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/',    getAll);

/**
 * @swagger
 * /api/customers/{id}:
 *   get:
 *     tags: [Customers]
 *     summary: Get customer by ID
 *     description: Get customer details with order history count.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Customer detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Customer'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', validate(idParamSchema), getOne);

/**
 * @swagger
 * /api/customers:
 *   post:
 *     tags: [Customers]
 *     summary: Create a new customer
 *     description: Create a new customer record. Restricted to cashier and above.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, phone, type]
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Kamau
 *               phone:
 *                 type: string
 *                 example: "+254 712 111 222"
 *               email:
 *                 type: string
 *                 format: email
 *                 nullable: true
 *                 example: john@example.com
 *               type:
 *                 type: string
 *                 enum: [retail, wholesale]
 *               creditLimit:
 *                 type: string
 *                 nullable: true
 *                 example: "0.00"
 *     responses:
 *       201:
 *         description: Customer created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Customer'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */

/**
 * @swagger
 * /api/customers/{id}:
 *   put:
 *     tags: [Customers]
 *     summary: Update customer
 *     description: Update customer information. Restricted to cashier and above.
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
 *               phone: { type: string }
 *               email: { type: string, format: email, nullable: true }
 *               type: { type: string, enum: [retail, wholesale] }
 *               creditLimit: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Customer updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Customer'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

router.put('/:id',
  authorize(['admin', 'manager', 'cashier']),
  validate(updateCustomerSchema),
  updateOne
);

/**
 * @swagger
 * /api/customers/{id}:
 *   delete:
 *     tags: [Customers]
 *     summary: Delete a customer
 *     description: Soft-delete a customer. Restricted to admin and manager.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Customer deleted
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
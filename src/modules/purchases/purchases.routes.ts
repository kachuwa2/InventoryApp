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
/**
 * @swagger
 * /api/purchases:
 *   get:
 *     tags: [Purchases]
 *     summary: List purchase orders
 *     description: Get all purchase orders with optional filtering by status.
 *     parameters:
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, approved, received, cancelled] }
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Purchase order list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/PurchaseOrder'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/',    getAll);

/**
 * @swagger
 * /api/purchases/{id}:
 *   get:
 *     tags: [Purchases]
 *     summary: Get purchase order by ID
 *     description: Get purchase order details with all line items.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Purchase order detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/PurchaseOrder'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', validate(idParamSchema), getOne);

// Only admin and manager can create and update
/**
 * @swagger
 * /api/purchases:
 *   post:
 *     tags: [Purchases]
 *     summary: Create a purchase order
 *     description: |
 *       Create a new purchase order in draft status.
 *       Workflow: draft → approved → received → completed.
 *       Restricted to admin and manager.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [supplierId, items]
 *             properties:
 *               supplierId:
 *                 type: string
 *                 format: uuid
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [productId, quantityOrdered, unitCost]
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     quantityOrdered: { type: string, example: "50" }
 *                     unitCost: { type: string, example: "8.50" }
 *               supplierReference:
 *                 type: string
 *                 nullable: true
 *               expectedAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               notes:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       201:
 *         description: Purchase order created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/PurchaseOrder'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/',
  authorize(['admin', 'manager']),
  validate(createPurchaseOrderSchema),
  createOne
);

/**
 * @swagger
 * /api/purchases/{id}:
 *   put:
 *     tags: [Purchases]
 *     summary: Update purchase order
 *     description: Update draft purchase order details. Restricted to admin and manager.
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
 *               supplierId: { type: string, format: uuid }
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     quantityOrdered: { type: string }
 *                     unitCost: { type: string }
 *               supplierReference: { type: string, nullable: true }
 *               expectedAt: { type: string, format: date-time, nullable: true }
 *               notes: { type: string, nullable: true }
 *     responses:
 *       200:
 *         description: Purchase order updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/PurchaseOrder'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */

// Approve — admin and manager only
/**
 * @swagger
 * /api/purchases/{id}/approve:
 *   post:
 *     tags: [Purchases]
 *     summary: Approve a purchase order
 *     description: |
 *       Change PO status from draft to approved.
 *       Only approved orders can be received.
 *       Restricted to admin and manager.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Purchase order approved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/PurchaseOrder'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:id/approve',
  authorize(['admin', 'manager']),
  validate(idParamSchema),
  approve
);

// Receive stock — warehouse and above
// Warehouse staff physically receive the goods
/**
 * @swagger
 * /api/purchases/{id}/receive:
 *   post:
 *     tags: [Purchases]
 *     summary: Receive a purchase order
 *     description: |
 *       Record receipt of goods. Changes PO status to received and
 *       creates stock movement entries.
 *       Restricted to warehouse and above.
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
 *             required: [items]
 *             properties:
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [poItemId, quantityReceived]
 *                   properties:
 *                     poItemId: { type: string, format: uuid }
 *                     quantityReceived: { type: string, example: "50" }
 *               receivedAt:
 *                 type: string
 *                 format: date-time
 *                 nullable: true
 *               notes:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Goods received
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/PurchaseOrder'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:id/receive',
  authorize(['admin', 'manager', 'warehouse']),
  validate(receivePurchaseOrderSchema),
  receive
);

// Cancel — admin and manager only
/**
 * @swagger
 * /api/purchases/{id}/cancel:
 *   post:
 *     tags: [Purchases]
 *     summary: Cancel a purchase order
 *     description: |
 *       Change PO status to cancelled.
 *       Only draft and approved orders can be cancelled.
 *       Restricted to admin and manager.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Purchase order cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/PurchaseOrder'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post('/:id/cancel',
  authorize(['admin', 'manager']),
  validate(idParamSchema),
  cancel
);

export default router;
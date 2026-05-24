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
/**
 * @swagger
 * /api/sales/daily-summary:
 *   get:
 *     tags: [Sales]
 *     summary: Get daily sales summary
 *     description: Get summary of today's sales by type (retail/wholesale).
 *     responses:
 *       200:
 *         description: Daily summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalRetail: { type: number, example: 1250.50 }
 *                     totalWholesale: { type: number, example: 3500.00 }
 *                     totalSales: { type: number, example: 4750.50 }
 *                     retailCount: { type: integer, example: 15 }
 *                     wholesaleCount: { type: integer, example: 3 }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/daily-summary', dailySummary);

/**
 * @swagger
 * /api/sales:
 *   get:
 *     tags: [Sales]
 *     summary: List sales orders
 *     description: Get all sales orders with optional filtering.
 *     parameters:
 *       - in: query
 *         name: type
 *         schema: { type: string, enum: [retail, wholesale] }
 *       - in: query
 *         name: customerId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Sales orders
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SalesOrder'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/',              getAll);

/**
 * @swagger
 * /api/sales/{id}:
 *   get:
 *     tags: [Sales]
 *     summary: Get sales order by ID
 *     description: Get sales order details with all line items.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Sales order detail
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/SalesOrder'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id',           validate(idParamSchema), getOne);

// Cashier and above can create sales
/**
 * @swagger
 * /api/sales:
 *   post:
 *     tags: [Sales]
 *     summary: Create a sales order
 *     description: |
 *       Create a new sales order. Can be retail or wholesale.
 *       Automatically creates stock movements.
 *       Restricted to cashier and above.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, items]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [retail, wholesale]
 *               customerId:
 *                 type: string
 *                 format: uuid
 *                 nullable: true
 *               discount:
 *                 type: string
 *                 nullable: true
 *                 example: "10"
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [productId, quantity]
 *                   properties:
 *                     productId: { type: string, format: uuid }
 *                     quantity: { type: string, example: "2" }
 *                     unitPrice: { type: string, nullable: true }
 *                     discountPct: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Sales order created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/SalesOrder'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/',
  authorize(['admin', 'manager', 'cashier']),
  validate(createSaleSchema),
  createOne
);

export default router;
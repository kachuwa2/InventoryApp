import { Router } from 'express';
import {
  getStockLevels,
  getLowStock,
  getMovements,
  adjust,
  getValuation,
} from './inventory.controller';
import { authenticate }  from '../../middleware/authentication';
import { authorize }     from '../../middleware/authorize';
import { validate }      from '../../middleware/validate';
import {
  adjustStockSchema,
  productIdParamSchema,
} from './inventory.schema';

const router = Router();

router.use(authenticate);

// Stock levels — any logged in user can view
/**
 * @swagger
 * /api/inventory:
 *   get:
 *     tags: [Inventory]
 *     summary: Get current stock levels
 *     description: |
 *       Get stock quantities for all products computed from stock movements.
 *       Stock is never stored — always calculated.
 *     responses:
 *       200:
 *         description: Stock levels
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InventoryItem'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', getStockLevels);

/**
 * @swagger
 * /api/inventory/low-stock:
 *   get:
 *     tags: [Inventory]
 *     summary: Get low-stock products
 *     description: Get products with stock below reorder point.
 *     responses:
 *       200:
 *         description: Low-stock products
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/InventoryItem'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/low-stock', getLowStock);

/**
 * @swagger
 * /api/inventory/valuation:
 *   get:
 *     tags: [Inventory]
 *     summary: Get inventory valuation
 *     description: Get total stock value by category at current cost prices.
 *     responses:
 *       200:
 *         description: Valuation data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       categoryName: { type: string, example: Cookware }
 *                       totalValue: { type: number, example: 5000.50 }
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/valuation', getValuation);

// Movement history for a specific product
/**
 * @swagger
 * /api/inventory/{productId}/movements:
 *   get:
 *     tags: [Inventory]
 *     summary: Get stock movements for a product
 *     description: Get full history of inbound and outbound stock movements.
 *     parameters:
 *       - in: path
 *         name: productId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Stock movements
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StockMovement'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get(
  '/:productId/movements',
  validate(productIdParamSchema),
  getMovements
);

// Manual adjustments — warehouse and above only
/**
 * @swagger
 * /api/inventory/adjust:
 *   post:
 *     tags: [Inventory]
 *     summary: Adjust stock manually
 *     description: |
 *       Create manual stock adjustments (add or remove inventory).
 *       Creates a stock movement record for audit trail.
 *       Restricted to warehouse and above.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, type, quantity, notes]
 *             properties:
 *               productId:
 *                 type: string
 *                 format: uuid
 *               type:
 *                 type: string
 *                 enum: [adjustment_in, adjustment_out]
 *                 example: adjustment_in
 *               quantity:
 *                 type: string
 *                 example: "10"
 *               notes:
 *                 type: string
 *                 example: "Inventory recount correction"
 *     responses:
 *       201:
 *         description: Adjustment recorded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: boolean, example: true }
 *                 data:
 *                   $ref: '#/components/schemas/StockMovement'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.post(
  '/adjust',
  authorize(['admin', 'manager', 'warehouse']),
  validate(adjustStockSchema),
  adjust
);

export default router;